import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Paperclip } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import PersonaManager, { Persona } from "@/components/PersonaManager";
import { usePersonas } from "@/hooks/use-personas";
import { useUpdateProject } from "@/hooks/use-project";
import ContextFileUpload, { ContextFileEntry } from "@/components/ContextFileUpload";
import {
  useContextDocuments,
  useAddContextDocument,
  useDeleteContextDocument,
} from "@/hooks/use-context-documents";
import type { ContextDocumentRow } from "@/services/context-documents.service";
import ContextDocumentItem from "@/components/context-documents/ContextDocumentItem";
import { DocumentLinkInput, type LinkEntry } from "@/components/context-documents/DocumentLinkInput";
import { FEATURE_DRIVE_NOTION_IMPORT } from "@/lib/feature-flags";
import {
  useIntegrationStatus,
  useFetchIntegrationDocuments,
  useParseIntegrationUrls,
  useSaveIntegrationDocumentsToProject,
} from "@/hooks/use-integrations";
import type { Project } from "@/services/project.service";

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onSave: (updatedProject: Project) => void;
}

const EditProjectDialog = ({
  open,
  onOpenChange,
  project,
  onSave,
}: EditProjectDialogProps) => {
  const { t } = useLanguage();
  const [name, setName] = useState(project.name);
  const [mission, setMission] = useState(project.mission);
  const [globalMission, setGlobalMission] = useState(project.global_mission || "");
  const [constraints, setConstraints] = useState(project.constraints || "");
  const [language, setLanguage] = useState(project.language || "system");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const isSection = project.scope === "section";

  const { data: personasData, isLoading: loadingPersonas } = usePersonas(open ? project.id : undefined);
  const { data: contextDocs = [], isLoading: loadingDocs } = useContextDocuments(open ? project.id : undefined);
  const updateProject = useUpdateProject(project.id);
  const addContextDoc = useAddContextDocument(project.id);
  const deleteContextDoc = useDeleteContextDocument(project.id);
  const [pendingFiles, setPendingFiles] = useState<ContextFileEntry[]>([]);
  const [contextExtracting, setContextExtracting] = useState(false);
  const [hasUnfetchedLinks, setHasUnfetchedLinks] = useState(false);
  const { data: status } = useIntegrationStatus();
  const fetchDocuments = useFetchIntegrationDocuments();
  const { parseDriveUrl, parseNotionUrl } = useParseIntegrationUrls();
  const saveIntegrationDocs = useSaveIntegrationDocumentsToProject(project.id);

  // Sync project and personas into local state when dialog opens or data loads
  useEffect(() => {
    if (!open) return;
    setName(project.name);
    setMission(project.mission);
    setGlobalMission(project.global_mission || "");
    setConstraints(project.constraints || "");
    setLanguage(project.language || "system");
    setPendingFiles([]);
    setHasUnfetchedLinks(false);
  }, [open, project.id, project.name, project.mission, project.global_mission, project.constraints, project.language]);

  useEffect(() => {
    if (!open || personasData === undefined) return;
    if (personasData.length > 0) {
      setPersonas(personasData.map((p) => ({ id: p.id, name: p.name, description: p.description })));
    } else {
      setPersonas([{ name: "Default Persona", description: project.persona || "" }]);
    }
  }, [open, project.id, project.persona, personasData]);

  const handleLinkFetch = async (links: LinkEntry[]) => {
    const driveIds: string[] = [];
    const notionIds: string[] = [];
    for (const link of links) {
      if (link.provider === "drive") {
        const id = parseDriveUrl(link.url);
        if (id) driveIds.push(id);
      } else if (link.provider === "notion") {
        const id = parseNotionUrl(link.url);
        if (id) notionIds.push(id);
      }
    }

    try {
      const docs = await fetchDocuments.mutateAsync({ driveIds, notionIds });
      if (docs.length === 0) return;

      // Separate successful docs from failed ones
      const successDocs = docs.filter((d) => !d.error && d.content?.trim());
      const failedDocs = docs.filter((d) => d.error || !d.content?.trim());

      // Save successful docs
      for (const doc of successDocs) {
        const matchingLink = links.find((l) => {
          if (l.provider === "drive") return parseDriveUrl(l.url) === doc.id;
          if (l.provider === "notion") return parseNotionUrl(l.url) === doc.id;
          return false;
        });
        const source = matchingLink?.provider === "notion" ? "notion" as const : "drive" as const;
        await saveIntegrationDocs.mutateAsync({ source, documents: [doc] });
      }

      // Show results
      if (failedDocs.length > 0) {
        const hasPermissionError = failedDocs.some((d) => d.error === "not_found" || d.error === "access_denied");
        if (hasPermissionError) {
          toast.error(t("integrationFetchPermissionError"));
        } else {
          toast.error(t("integrationFetchPartialFailed").replace("{count}", String(failedDocs.length)));
        }
      }
      if (successDocs.length > 0) {
        toast.success(`Fetched and saved ${successDocs.length} document${successDocs.length !== 1 ? "s" : ""}`);
      }
    } catch (error) {
      // Check if it's a disconnected integration issue
      const isDriveDisconnected = !status?.drive && links.some((l) => l.provider === "drive");
      const isNotionDisconnected = !status?.notion && links.some((l) => l.provider === "notion");
      const isNetworkError =
        error instanceof TypeError && error.message === "Failed to fetch";

      if (isDriveDisconnected || isNotionDisconnected) {
        const providers = [
          isDriveDisconnected ? "Google Drive" : null,
          isNotionDisconnected ? "Notion" : null,
        ].filter(Boolean).join(" & ");
        toast.error(t("integrationFetchDisconnected").replace("{providers}", providers));
      } else if (isNetworkError) {
        toast.error(t("integrationFetchNetworkError"));
      } else {
        toast.error(t("integrationFetchFailed"));
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t("enterProjectName"));
      return;
    }
    if (!mission.trim()) {
      toast.error(t("describeMission"));
      return;
    }

    const validPersonas = personas.filter((p) => p.name.trim() && p.description.trim());
    if (validPersonas.length === 0) {
      toast.error(t("atLeastOnePersona"));
      return;
    }

    try {
      const savedLanguage = language === "system" ? "" : language;
      await updateProject.mutateAsync({
        name: name.trim(),
        mission: mission.trim(),
        persona: validPersonas[0]?.description || "",
        constraints: constraints.trim() || null,
        language: savedLanguage,
        personas: validPersonas.map((p) => ({ name: p.name.trim(), description: p.description.trim() })),
        global_mission: isSection ? (globalMission.trim() || null) : undefined,
      });

      // Upload any new context files
      for (const pf of pendingFiles) {
        await addContextDoc.mutateAsync({
          file: pf.file,
          extractedText: pf.extractedText,
        });
      }

      toast.success(t("contextUpdated"));
      onSave({
        ...project,
        name: name.trim(),
        mission: mission.trim(),
        persona: validPersonas[0]?.description || "",
        constraints: constraints.trim() || null,
        language: savedLanguage,
      });
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update project");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{t("editContext")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-1">
          <div className="space-y-8 py-4">
            {/* Section: Basics */}
            <section className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-primary">{t("productName")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("projectNamePlaceholder")}
                  className="glass border-border"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground text-right">{name.length}/100</p>
              </div>
              {isSection && (
                <div className="space-y-2">
                  <Label htmlFor="global-mission" className="text-primary">{t("globalMissionLabel")}</Label>
                  <p className="text-xs text-muted-foreground">{t("globalMissionHint")}</p>
                  <Textarea
                    id="global-mission"
                    value={globalMission}
                    onChange={(e) => setGlobalMission(e.target.value)}
                    placeholder={t("missionPlaceholder")}
                    className="glass border-border min-h-[60px]"
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-right">{globalMission.length}/500</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="mission" className="text-primary">
                  {isSection ? t("whatsSectionMission") : t("whatsProductMission")}
                </Label>
                <Textarea
                  id="mission"
                  value={mission}
                  onChange={(e) => setMission(e.target.value)}
                  placeholder={isSection ? t("missionPlaceholderSection") : t("missionPlaceholder")}
                  className="glass border-border min-h-[80px]"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">{mission.length}/500</p>
              </div>
            </section>

            {/* Section: Personas */}
            <section className="space-y-3 pt-2 border-t border-border">
              {loadingPersonas ? (
                <div role="status" aria-live="polite" aria-busy="true" className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
                  <span className="sr-only">Loading…</span>
                </div>
              ) : (
                <PersonaManager
                  personas={personas}
                  onChange={setPersonas}
                  disabled={updateProject.isPending}
                />
              )}
            </section>

            {/* Section: Constraints */}
            <section className="space-y-4 pt-2 border-t border-border">
              <div className="space-y-2">
                <Label htmlFor="constraints" className="text-primary">
                  {t("constraints")} <span className="text-muted-foreground font-normal">({t("optional")})</span>
                </Label>
                <Textarea
                  id="constraints"
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  placeholder={t("constraintsPlaceholder")}
                  className="glass border-border min-h-[60px]"
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground text-right">{constraints.length}/200</p>
              </div>
            </section>

            {/* Section: Additional context */}
            <section className="space-y-3 pt-2 border-t border-border">
              <h3 className="text-sm font-medium text-primary flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-primary" />
                {t("additionalContextSection")} <span className="text-muted-foreground font-normal">({t("optional")})</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("additionalContextDesc")}
              </p>
              <div className="space-y-4">
                {loadingDocs ? (
                  <div role="status" aria-live="polite" aria-busy="true" className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                    <span className="sr-only">Loading…</span>
                  </div>
                ) : contextDocs.length > 0 ? (
                  <ul className="space-y-2 max-h-[200px] overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
                    {contextDocs.map((doc: ContextDocumentRow) => (
                      <ContextDocumentItem
                        key={doc.id}
                        doc={doc}
                        onDelete={(d) => deleteContextDoc.mutate(d)}
                        deleteDisabled={updateProject.isPending || deleteContextDoc.isPending}
                      />
                    ))}
                  </ul>
                ) : null}

                <ContextFileUpload
                  files={pendingFiles}
                  onChange={setPendingFiles}
                  disabled={updateProject.isPending}
                  onExtractingChange={setContextExtracting}
                />

                {FEATURE_DRIVE_NOTION_IMPORT && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">{t("linkInputOr")}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <DocumentLinkInput
                      maxLinks={5}
                      onFetchClicked={handleLinkFetch}
                      onHasUnfetchedLinksChange={setHasUnfetchedLinks}
                      disabled={fetchDocuments.isPending || saveIntegrationDocs.isPending}
                      loadingLabel={t("importFetching")}
                      returnTo={`/project/${project.id}`}
                    />
                  </>
                )}
              </div>
            </section>

            {/* Section: Report language (at end) */}
            <section className="space-y-2 pt-2 border-t border-border">
              <Label htmlFor="language" className="text-primary">{t("reportLanguage")}</Label>
              <p className="text-xs text-muted-foreground">{t("chooseReportLanguage")}</p>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="glass border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent modal={false} className="bg-popover border-border">
                  <SelectItem value="system">{t("languageSystem")}</SelectItem>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Italian">Italian</SelectItem>
                </SelectContent>
              </Select>
            </section>
          </div>
        </div>

        <div className="flex justify-end gap-2 flex-shrink-0 pt-4 mt-2 border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateProject.isPending}
          >
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={updateProject.isPending || loadingPersonas || hasUnfetchedLinks || contextExtracting} aria-busy={updateProject.isPending} title={contextExtracting ? t("extractingText") : undefined}>
            {updateProject.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("saving")}
              </>
            ) : (
              t("save")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditProjectDialog;
