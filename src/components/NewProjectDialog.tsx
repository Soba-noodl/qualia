import { useState, useEffect, Fragment } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { Loader2, Target, Users, AlertTriangle, Languages, Info, Coffee, Zap, Paperclip, CloudDownload, FileSearch, LayoutGrid, Box, Tag, SlidersHorizontal, Check } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useLanguage } from "@/contexts/LanguageContext";
import PersonaManager, { Persona } from "@/components/PersonaManager";
import { useCreateProject, useExistingProducts } from "@/hooks/use-projects";
import { useMyOrganization } from "@/hooks/use-organizations";
import ContextFileUpload, { ContextFileEntry } from "@/components/ContextFileUpload";
import SetupForkScreen, { type SetupMode } from "@/components/project-setup/SetupForkScreen";
import { DocumentLinkInput, type LinkEntry } from "@/components/context-documents/DocumentLinkInput";
import { FEATURE_DRIVE_NOTION_IMPORT } from "@/lib/feature-flags";
import {
  useFetchIntegrationDocuments,
  useExtractProjectContext,
  useParseIntegrationUrls,
  useIntegrationStatus,
  useInitiateOAuth,
} from "@/hooks/use-integrations";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  saveIntegrationDocumentsToProject,
  type FetchedIntegrationDocument,
} from "@/services/integration.service";

export type InitialFromPlugin = {
  scope: "whole" | "section";
  productName: string;
  sectionName?: string;
};

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when project is created. Passes new project id so caller can e.g. navigate and open upload modal. */
  onSuccess: (projectId?: string) => void;
  /** When set, open directly in this mode (e.g. after OAuth return). */
  initialSetupMode?: SetupMode;
  /** Pre-fill scope and names when opened from plugin (e.g. Create or edit project in Qualia). */
  initialFromPlugin?: InitialFromPlugin | null;
  /** Pre-selects destination based on which dashboard view the user came from. */
  initialScope?: "personal" | "team";
}

const NewProjectDialog = ({ open, onOpenChange, onSuccess, initialSetupMode, initialFromPlugin, initialScope }: NewProjectDialogProps) => {
  const { t } = useLanguage();
  const { data: org } = useMyOrganization();
  
  // Define options using translation keys
  const ACCESSIBILITY_OPTIONS = [
    { value: "none", labelKey: "constraintNone" as const },
    { value: "wcag-aa", labelKey: "constraintWcagAA" as const },
    { value: "wcag-aaa", labelKey: "constraintWcagAAA" as const },
    { value: "section-508", labelKey: "constraintSection508" as const },
  ];

  const PLATFORM_OPTIONS = [
    { value: "desktop", labelKey: "platformDesktop" as const },
    { value: "mobile-web", labelKey: "platformMobileWeb" as const },
    { value: "ios-native", labelKey: "platformIosNative" as const },
    { value: "android-native", labelKey: "platformAndroidNative" as const },
    { value: "tablet", labelKey: "platformTablet" as const },
  ];

  const DESIGN_SYSTEM_OPTIONS = [
    { value: "none", labelKey: "designSystemCustom" as const },
    { value: "material-3", labelKey: "designSystemMaterial3" as const },
    { value: "apple-hig", labelKey: "designSystemAppleHIG" as const },
    { value: "ant-design", labelKey: "designSystemAntDesign" as const },
    { value: "tailwind-ui", labelKey: "designSystemTailwindUI" as const },
    { value: "bootstrap", labelKey: "designSystemBootstrap" as const },
  ];

  const ARCHETYPE_PRESETS = [
    {
      id: "average-user",
      titleKey: "presetAverageUserTitle" as const,
      subtitleKey: "presetAverageUserSubtitle" as const,
      nameKey: "presetAverageUserName" as const,
      descriptionKey: "presetAverageUserDescription" as const,
      icon: Coffee,
    },
    {
      id: "power-user",
      titleKey: "presetPowerUserTitle" as const,
      subtitleKey: "presetPowerUserSubtitle" as const,
      nameKey: "presetPowerUserName" as const,
      descriptionKey: "presetPowerUserDescription" as const,
      icon: Zap,
    },
  ];
  
  const [setupMode, setSetupMode] = useState<SetupMode>(initialSetupMode === "import" ? "import" : "manual");
  const [step, setStep] = useState(1);
  type ProjectScope = "whole" | "section";
  const [projectScope, setProjectScope] = useState<ProjectScope | null>(null);
  type ProductSource = "new" | "existing";
  const [productSource, setProductSource] = useState<ProductSource>("new");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [destination, setDestination] = useState<"personal" | "team">(
    initialScope === "team" && org ? "team" : "personal"
  );
  const [showDestPicker, setShowDestPicker] = useState(false);

  // When opened with initialSetupMode (e.g. after OAuth return), switch to that mode and reset import step
  useEffect(() => {
    if (open && initialSetupMode) {
      setSetupMode(initialSetupMode);
      if (initialSetupMode === "import") setImportStep(1);
    }
  }, [open, initialSetupMode]);

  // Sync destination to current initialScope whenever the dialog opens.
  // useState initializer only runs once, so without this effect switching the
  // dashboard toggle and re-opening the dialog would show a stale destination.
  useEffect(() => {
    if (open) {
      setDestination(initialScope === "team" && org ? "team" : "personal");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Pre-fill from plugin (Create or edit project in Qualia link with query params)
  useEffect(() => {
    if (open && initialFromPlugin?.productName) {
      setProjectScope(initialFromPlugin.scope);
      setFormData((prev) => ({
        ...prev,
        name:
          initialFromPlugin.scope === "whole"
            ? initialFromPlugin.productName
            : (initialFromPlugin.sectionName ?? ""),
        productName: initialFromPlugin.scope === "section" ? initialFromPlugin.productName : "",
      }));
    }
  }, [open, initialFromPlugin]);

  // Pre-fill personas with Average User on first open if still empty.
  // Intentionally only depends on `open` — adding `personas` would reset them while the user types.
  useEffect(() => {
    if (open && personas.length === 1 && !personas[0].name.trim() && !personas[0].description.trim()) {
      setPersonas([{ name: t("presetAverageUserName"), description: t("presetAverageUserDescription") }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: integrationStatus } = useIntegrationStatus();
  const initiateOAuth = useInitiateOAuth();
  const queryClient = useQueryClient();
  const { productOptions, getTemplateForProduct } = useExistingProducts();
  const driveConnected = integrationStatus?.drive ?? false;
  const notionConnected = integrationStatus?.notion ?? false;
  const hasAnyConnection = driveConnected || notionConnected;

  // After OAuth return: refetch integration status so we show paste step, not connect step
  useEffect(() => {
    if (open && setupMode === "import") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.status() });
    }
  }, [open, setupMode, queryClient]);
  const [formData, setFormData] = useState({
    name: "",
    productName: "",
    mission: "",
    globalMission: "",
    constraints: "",
    language: "system",
  });
  const [personas, setPersonas] = useState<Persona[]>([
    { name: "", description: "" }
  ]);
  const [contextFiles, setContextFiles] = useState<ContextFileEntry[]>([]);
  const [contextExtracting, setContextExtracting] = useState(false);

  // Quick constraint selections
  const [selectedCompliance, setSelectedCompliance] = useState("none");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedDesignSystem, setSelectedDesignSystem] = useState("none");

  // ── Import flow state ──
  const [importStep, setImportStep] = useState(1);
  const [importLinks, setImportLinks] = useState<LinkEntry[]>([]);
  const [importFiles, setImportFiles] = useState<ContextFileEntry[]>([]);
  const [fetchedDocs, setFetchedDocs] = useState<FetchedIntegrationDocument[]>([]);

  // ── Link docs for manual step 5 ──
  const [pendingLinkDocs, setPendingLinkDocs] = useState<FetchedIntegrationDocument[]>([]);

  // ── Import flow: effective scope (from LLM or user toggle) ──
  const [importScope, setImportScope] = useState<"whole" | "section">("whole");

  // Integration hooks
  const fetchDocuments = useFetchIntegrationDocuments();
  const extractContext = useExtractProjectContext();
  const { parseDriveUrl, parseNotionUrl } = useParseIntegrationUrls();

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!projectScope) return;
      if (!formData.name.trim()) {
        toast.error(t("enterProjectName"));
        return;
      }
      if (projectScope === "section" && !formData.productName.trim()) {
        toast.error(t("enterProjectName"));
        return;
      }
    }
    if (step === 2 && !formData.mission.trim()) {
      toast.error(t("describeMission"));
      return;
    }
    if (step === 3) {
      const validPersonas = personas.filter(p => p.name.trim() && p.description.trim());
      if (validPersonas.length === 0) {
        toast.error(t("atLeastOnePersona"));
        return;
      }
    }
    setStep(step + 1);
  };

  const canContinue = () => {
    if (step === 1) {
      if (!projectScope) return false;
      if (projectScope === "section") return formData.name.trim().length > 0 && formData.productName.trim().length > 0;
      return formData.name.trim().length > 0;
    }
    if (step === 2) return formData.mission.trim().length > 0;
    if (step === 3) {
      const validPersonas = personas.filter(p => p.name.trim() && p.description.trim());
      return validPersonas.length > 0;
    }
    return true;
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const buildConstraintsString = () => {
    const parts: string[] = [];
    
    // Safely handle platform selections
    if (selectedPlatforms && selectedPlatforms.length > 0) {
      const platformLabels = selectedPlatforms.map(p => {
        const opt = PLATFORM_OPTIONS.find(o => o.value === p);
        return opt ? t(opt.labelKey) : p;
      });
      parts.push(`PLATFORM: [${platformLabels.join(", ")}]`);
    }
    
    // Safely handle compliance - only include if not "none"
    if (selectedCompliance && selectedCompliance !== "none") {
      const opt = ACCESSIBILITY_OPTIONS.find(o => o.value === selectedCompliance);
      const complianceLabel = opt ? t(opt.labelKey) : selectedCompliance;
      parts.push(`COMPLIANCE: [${complianceLabel}]`);
    }
    
    // Safely handle design system - only include if not "none"
    if (selectedDesignSystem && selectedDesignSystem !== "none") {
      const opt = DESIGN_SYSTEM_OPTIONS.find(o => o.value === selectedDesignSystem);
      const designLabel = opt ? t(opt.labelKey) : selectedDesignSystem;
      parts.push(`FRAMEWORK: [${designLabel}]`);
    }
    
    // Safely handle additional constraints text
    if (formData.constraints && formData.constraints.trim()) {
      parts.push(`ADDITIONAL: [${formData.constraints.trim()}]`);
    }
    
    // Return null if no constraints were selected (100% optional)
    return parts.length > 0 ? parts.join(". ") : null;
  };

  const createProject = useCreateProject();

  const handleSubmit = async () => {
    const validPersonas = personas.filter(p => p.name.trim() && p.description.trim());
    const combinedConstraints = buildConstraintsString();
    const projectName =
      projectScope === "section"
        ? `${formData.name.trim()} - ${formData.productName.trim()}`
        : formData.name.trim();

    try {
      const project = await createProject.mutateAsync({
        name: projectName,
        mission: formData.mission.trim(),
        persona: validPersonas[0]?.description || "",
        constraints: combinedConstraints,
        language: formData.language === "system" ? "" : formData.language,
        personas: validPersonas.map(p => ({ name: p.name.trim(), description: p.description.trim() })),
        contextFiles,
        scope: projectScope ?? "whole",
        product_name: projectScope === "section" ? formData.productName.trim() || null : null,
        global_mission: projectScope === "section" ? formData.globalMission.trim() || null : null,
        org_id: destination === "team" && org ? org.id : null,
      });

      // Save any pending link documents from manual step 5
      if (pendingLinkDocs.length > 0 && project?.id) {
        for (const doc of pendingLinkDocs) {
          const source = doc.id.includes("notion") ? "notion" as const : "drive" as const;
          await saveIntegrationDocumentsToProject(project.id, source, [doc]);
        }
      }

      toast.success(t("projectCreatedSuccess"));
      resetForm();
      onSuccess(project.id);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    }
  };

  // ── Import flow: fetch + extract ──
  const handleImportContinue = async () => {
    if (importLinks.length === 0 && importFiles.length === 0) {
      toast.error(t("importNoLinks"));
      return;
    }

    // Group links by provider
    const driveIds: string[] = [];
    const notionIds: string[] = [];
    for (const link of importLinks) {
      if (link.provider === "drive") {
        const id = parseDriveUrl(link.url);
        if (id) driveIds.push(id);
      } else if (link.provider === "notion") {
        const id = parseNotionUrl(link.url);
        if (id) notionIds.push(id);
      }
    }

    try {
      // Fetch documents from integrations (if any)
      const integrationDocs =
        driveIds.length > 0 || notionIds.length > 0
          ? await fetchDocuments.mutateAsync({ driveIds, notionIds })
          : [];

      // Build documents from uploaded files
      const uploadDocs = importFiles.map((entry, index) => ({
        id: `upload-${index}-${entry.file.name}`,
        name: entry.file.name,
        content: entry.extractedText,
      }));

      const allDocs = [...integrationDocs, ...uploadDocs];

      if (allDocs.length === 0) {
        toast.error(t("integrationFetchFailed"));
        return;
      }
      setFetchedDocs(integrationDocs);

      // Extract context from both integration and local documents
      const extracted = await extractContext.mutateAsync(allDocs);
      const isSection = extracted.scope === "section";

      setImportScope(isSection ? "section" : "whole");

      // Pre-fill form: section = section_name + product_name + mission; whole = name + mission
      setFormData((prev) => ({
        ...prev,
        name: isSection
          ? (extracted.section_name ?? extracted.name ?? "")
          : (extracted.name ?? prev.name),
        productName: isSection ? (extracted.product_name ?? "") : "",
        mission: extracted.mission ?? prev.mission,
        globalMission: isSection ? (extracted.global_mission ?? "") : "",
        constraints: extracted.constraints ?? prev.constraints,
      }));

      if (extracted.archetypes && extracted.archetypes.length > 0) {
        setPersonas(
          extracted.archetypes.map((a) => ({
            name: a.name,
            description: a.description,
          }))
        );
      }

      setImportStep(2);
    } catch (error) {
      console.error("Import flow error:", error);
      const isNetworkError =
        error instanceof TypeError && error.message === "Failed to fetch";
      if (isNetworkError) {
        toast.error(t("integrationFetchNetworkError"));
      } else if (fetchDocuments.isError) {
        toast.error(t("integrationFetchFailed"));
      } else {
        toast.error(t("integrationExtractFailed"));
      }
    }
  };

  const handleImportSubmit = async () => {
    const validPersonas = personas.filter((p) => p.name.trim() && p.description.trim());
    if (importScope === "section") {
      if (!formData.name.trim()) {
        toast.error(t("enterProjectName"));
        return;
      }
      if (!formData.productName.trim()) {
        toast.error(t("enterProjectName"));
        return;
      }
    } else {
      if (!formData.name.trim()) {
        toast.error(t("enterProjectName"));
        return;
      }
    }
    if (!formData.mission.trim()) {
      toast.error(t("describeMission"));
      return;
    }
    if (validPersonas.length === 0) {
      toast.error(t("atLeastOnePersona"));
      return;
    }

    const projectName =
      importScope === "section"
        ? `${formData.name.trim()} - ${formData.productName.trim()}`
        : formData.name.trim();

    try {
      const project = await createProject.mutateAsync({
        name: projectName,
        mission: formData.mission.trim(),
        persona: validPersonas[0]?.description || "",
        constraints: formData.constraints.trim() || null,
        language: formData.language === "system" ? "" : formData.language,
        personas: validPersonas.map((p) => ({
          name: p.name.trim(),
          description: p.description.trim(),
        })),
        scope: importScope,
        product_name: importScope === "section" ? formData.productName.trim() : null,
        global_mission: importScope === "section" ? (formData.globalMission.trim() || null) : null,
        org_id: destination === "team" && org ? org.id : null,
      });

      // Save fetched docs as context documents
      if (project?.id && fetchedDocs.length > 0) {
        // Determine source per doc
        for (const doc of fetchedDocs) {
          // Infer source from the original links
          const matchingLink = importLinks.find((l) => {
            if (l.provider === "drive") {
              return parseDriveUrl(l.url) === doc.id;
            }
            if (l.provider === "notion") {
              return parseNotionUrl(l.url) === doc.id;
            }
            return false;
          });
          const source = matchingLink?.provider === "notion" ? "notion" as const : "drive" as const;
          await saveIntegrationDocumentsToProject(project.id, source, [doc]);
        }
      }

      toast.success(t("projectCreatedSuccess"));
      resetForm();
      onSuccess(project.id);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    }
  };

  // ── Manual step 5: fetch link docs inline ──
  const handleManualLinkFetch = async (links: LinkEntry[]) => {
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
      setPendingLinkDocs((prev) => [...prev, ...docs]);
      toast.success(`Fetched ${docs.length} document${docs.length !== 1 ? "s" : ""}`);
    } catch (error) {
      const isNetworkError =
        error instanceof TypeError && error.message === "Failed to fetch";
      toast.error(isNetworkError ? t("integrationFetchNetworkError") : t("integrationFetchFailed"));
    }
  };

  const resetForm = () => {
    setSetupMode("manual");
    setStep(1);
    setProjectScope(null);
    setImportStep(1);
    setImportScope("whole");
    setImportLinks([]);
    setImportFiles([]);
    setFetchedDocs([]);
    setPendingLinkDocs([]);
    setFormData({ name: "", productName: "", mission: "", globalMission: "", constraints: "", language: "system" });
    setPersonas([{ name: t("presetAverageUserName"), description: t("presetAverageUserDescription") }]);
    setContextFiles([]);
    setSelectedCompliance("none");
    setSelectedPlatforms([]);
    setSelectedDesignSystem("none");
    setProductSource("new");
    setSelectedProductId(null);
    setDestination(initialScope === "team" && org ? "team" : "personal");
    setShowDestPicker(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const TOTAL_STEPS = 4;
  const isImportProcessing = fetchDocuments.isPending || extractContext.isPending;

  const steps = [
    { number: 1, labelKey: "stepLabelName" as const, icon: Tag },
    { number: 2, labelKey: "stepLabelMission" as const, icon: Target },
    { number: 3, labelKey: "stepLabelUsers" as const, icon: Users },
    { number: 4, labelKey: "stepLabelDetails" as const, icon: SlidersHorizontal },
  ];

  const importSteps = [
    { number: 1, label: t("importStepSelectDocs"), icon: CloudDownload },
    { number: 2, label: t("importStepReview"), icon: FileSearch },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg glass border-border max-h-[90vh] flex flex-col overflow-hidden gap-5 p-6">
        <DialogHeader className="flex-shrink-0 pb-1">
          <DialogTitle className="text-xl">{t("createNewProject")}</DialogTitle>
        </DialogHeader>

        {/* Fork screen removed — we default to manual. Import link shown in header area. */}

        {/* ── Import flow ── */}
        {setupMode === "import" && (
          <>
            {/* Progress: Select docs → Review (same 2 steps whether or not tools are connected) */}
            <div className="flex flex-shrink-0 items-center justify-center mb-5 mt-0">
              {importSteps.map((s, i) => (
                <div key={s.number} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      importStep >= s.number
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-2 text-muted-foreground"
                    }`}
                  >
                    <s.icon className="h-4 w-4" />
                  </div>
                  {i < importSteps.length - 1 && (
                    <div
                      className={`w-10 h-0.5 mx-1 transition-colors ${
                        importStep > s.number ? "bg-primary" : "bg-surface-2"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
              {/* Step 1: Select documents (upload and/or connect + links — always shown) */}
              {importStep === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-base font-medium">
                      {t("importSelectDocsTitle")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t("importSelectDocsDesc")}
                    </p>
                  </div>

                  {/* Local file upload (always available) */}
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {t("additionalContextDesc")}
                    </p>
                    <ContextFileUpload
                      files={importFiles}
                      onChange={setImportFiles}
                      disabled={isImportProcessing}
                    />
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">
                      {t("linkInputOr")}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Optional: connect tools and add links */}
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      {t("importConnectToolsOptional")}
                    </p>
                    {hasAnyConnection ? (
                      <>
                        <DocumentLinkInput
                          maxLinks={5}
                          onLinksChange={setImportLinks}
                          showFetchButton={false}
                          showConnectionStatus={true}
                          disabled={isImportProcessing}
                          returnTo="new-project-import"
                        />
                      </>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => initiateOAuth.mutate({ provider: "drive", returnTo: "new-project-import" })}
                          disabled={initiateOAuth.isPending}
                        >
                          {initiateOAuth.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          ) : null}
                          {t("integrationConnectDrive")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => initiateOAuth.mutate({ provider: "notion", returnTo: "new-project-import" })}
                          disabled={initiateOAuth.isPending}
                        >
                          {initiateOAuth.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          ) : null}
                          {t("integrationConnectNotion")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Import Step 2: Review and edit */}
              {importStep === 2 && (
                <div className="space-y-5">
                  {/* Destination banner */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("destinationLabel")}</p>
                    {!showDestPicker ? (
                      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                        destination === "team"
                          ? "bg-primary/5 border-primary/30"
                          : "bg-surface-1 border-border"
                      }`}>
                        <span className="text-base">{destination === "team" ? "👥" : "🔒"}</span>
                        <span className="flex-1 text-sm">
                          {destination === "team" && org
                            ? t("destinationTeam").replace("{{teamName}}", org.name)
                            : t("destinationPersonal")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowDestPicker(true)}
                          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          {t("destinationChangeLink")}
                        </button>
                      </div>
                    ) : (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => { setDestination("personal"); setShowDestPicker(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface-1 transition-colors border-b border-border ${
                            destination === "personal" ? "bg-surface-1" : ""
                          }`}
                        >
                          <span>🔒</span>
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Personal</p>
                            <p className="text-sm font-medium">{t("destinationPersonal")}</p>
                          </div>
                          {destination === "personal" && <span className="text-primary text-xs">✓</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (org) { setDestination("team"); setShowDestPicker(false); } }}
                          disabled={!org}
                          className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${
                            !org ? "opacity-40 cursor-not-allowed" : "hover:bg-surface-1"
                          } ${destination === "team" ? "bg-surface-1" : ""}`}
                        >
                          <span>👥</span>
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Team</p>
                            <p className="text-sm font-medium">
                              {org
                                ? t("destinationTeam").replace("{{teamName}}", org.name)
                                : t("destinationNoTeamHint")}
                            </p>
                          </div>
                          {destination === "team" && <span className="text-primary text-xs">✓</span>}
                        </button>
                      </div>
                    )}
                  </div>

                  <Alert className="bg-primary/10 border-primary/30 text-foreground">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-foreground text-sm">
                      {t("importReviewDesc")}
                    </AlertDescription>
                  </Alert>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-1/50 p-3">
                    <div>
                      <Label htmlFor="import-scope-switch" className="text-sm font-medium cursor-pointer">
                        {t("importScopeSwitchLabel")}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("importScopeSwitchHint")}</p>
                    </div>
                    <Switch
                      id="import-scope-switch"
                      checked={importScope === "section"}
                      onCheckedChange={(checked) => setImportScope(checked ? "section" : "whole")}
                    />
                  </div>

                  {importScope === "whole" ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="import-name" className="text-sm font-medium">
                          {t("whatsYourProjectCalled")}
                        </Label>
                        <Input
                          id="import-name"
                          placeholder={t("projectNamePlaceholder")}
                          value={formData.name}
                          onChange={(e) => handleChange("name", e.target.value)}
                          className="bg-surface-1 border-border"
                          maxLength={100}
                        />
                        <p className="text-xs text-muted-foreground text-right mt-1">{formData.name.length}/100</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="import-mission" className="text-sm font-medium">
                          {t("whatsProductMission")}
                        </Label>
                        <Textarea
                          id="import-mission"
                          placeholder={t("missionPlaceholder")}
                          value={formData.mission}
                          onChange={(e) => handleChange("mission", e.target.value)}
                          className="bg-surface-1 border-border min-h-24 resize-none"
                          maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground text-right mt-1">{formData.mission.length}/500</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="import-section-name" className="text-sm font-medium">
                          {t("whatsSectionCalled")}
                        </Label>
                        <Input
                          id="import-section-name"
                          placeholder={t("sectionNamePlaceholder")}
                          value={formData.name}
                          onChange={(e) => handleChange("name", e.target.value)}
                          className="bg-surface-1 border-border"
                          maxLength={100}
                        />
                        <p className="text-xs text-muted-foreground text-right mt-1">{formData.name.length}/100</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="import-product-name" className="text-sm font-medium">
                          {t("productName")}
                        </Label>
                        <Input
                          id="import-product-name"
                          placeholder={t("projectNamePlaceholder")}
                          value={formData.productName}
                          onChange={(e) => handleChange("productName", e.target.value)}
                          className="bg-surface-1 border-border"
                          maxLength={100}
                        />
                        <p className="text-xs text-muted-foreground text-right mt-1">{formData.productName.length}/100</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="import-global-mission" className="text-sm font-medium">
                          {t("globalMissionLabel")}
                        </Label>
                        <p className="text-xs text-muted-foreground">{t("globalMissionHint")}</p>
                        <Textarea
                          id="import-global-mission"
                          placeholder={t("missionPlaceholder")}
                          value={formData.globalMission}
                          onChange={(e) => handleChange("globalMission", e.target.value)}
                          className="bg-surface-1 border-border min-h-20 resize-none"
                          maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground text-right mt-1">{formData.globalMission.length}/500</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="import-mission" className="text-sm font-medium">
                          {t("whatsSectionMission")}
                        </Label>
                        <Textarea
                          id="import-mission"
                          placeholder={t("missionPlaceholderSection")}
                          value={formData.mission}
                          onChange={(e) => handleChange("mission", e.target.value)}
                          className="bg-surface-1 border-border min-h-24 resize-none"
                          maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground text-right mt-1">{formData.mission.length}/500</p>
                      </div>
                    </>
                  )}

                  <PersonaManager
                    personas={personas}
                    onChange={setPersonas}
                    disabled={createProject.isPending}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="import-constraints" className="text-sm font-medium">
                      {t("constraints")} <span className="text-muted-foreground">({t("optional")})</span>
                    </Label>
                    <Textarea
                      id="import-constraints"
                      placeholder={t("constraintsPlaceholder")}
                      value={formData.constraints}
                      onChange={(e) => handleChange("constraints", e.target.value)}
                      className="bg-surface-1 border-border min-h-16 resize-none"
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground text-right mt-1">{formData.constraints.length}/200</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="import-language" className="text-sm font-medium">
                      {t("reportLanguage")}
                    </Label>
                    <Select
                      value={formData.language}
                      onValueChange={(value) => handleChange("language", value)}
                    >
                      <SelectTrigger className="bg-surface-1 border-border">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent modal={false} className="bg-popover border-border">
                        <SelectItem value="system">{t("languageSystem")}</SelectItem>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Italian">Italian</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Import footer */}
            <div className="flex flex-shrink-0 justify-between mt-6 pt-5 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => {
                  if (importStep === 1) {
                    setSetupMode("manual");
                    setStep(1);
                    setImportLinks([]);
                    setImportFiles([]);
                  } else {
                    setImportStep(1);
                  }
                }}
                disabled={isImportProcessing || createProject.isPending}
                className="text-muted-foreground"
              >
                {t("back")}
              </Button>

              {importStep === 1 ? (
                <Button
                  onClick={handleImportContinue}
                  disabled={
                    (importLinks.length === 0 && importFiles.length === 0) ||
                    isImportProcessing
                  }
                  className="bg-primary hover:bg-primary/90"
                  aria-busy={isImportProcessing}
                >
                  {isImportProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {fetchDocuments.isPending
                        ? t("importFetching")
                        : t("importExtracting")}
                    </>
                  ) : (
                    t("importFetchAndContinue")
                  )}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSetupMode("manual");
                      setStep(1);
                    }}
                    disabled={createProject.isPending}
                    className="text-muted-foreground text-sm"
                  >
                    {t("setupManualFallback")}
                  </Button>
                  <Button
                    onClick={handleImportSubmit}
                    disabled={createProject.isPending}
                    className="bg-primary hover:bg-primary/90 glow-purple"
                    aria-busy={createProject.isPending}
                  >
                    {createProject.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t("createProject")
                    )}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Manual flow: 4-step form (scope+name, mission, personas, details) ── */}
        {setupMode === "manual" && (
          <>
            <div className="flex-shrink-0 mb-3 mt-0 px-4">
              <div className="flex items-start justify-between max-w-md mx-auto">
                {steps.map((s, i) => {
                  const isReachable = s.number <= step;
                  return (
                    <Fragment key={s.number}>
                      {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: wizard stepper dot with circular badge (w-9 h-9 rounded-full), icon child, step label, aria-current; Button's rectangular h-10 shape and reset of layout would break the stepper visual */}
                      <button
                        type="button"
                        onClick={() => { if (isReachable) setStep(s.number); }}
                        disabled={!isReachable}
                        className={`flex flex-col items-center gap-1 ${isReachable ? "cursor-pointer" : "cursor-default"}`}
                        aria-current={step === s.number ? "step" : undefined}
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shadow-sm transition-colors ${
                            step >= s.number
                              ? "bg-primary text-primary-foreground"
                              : "bg-surface-2 text-muted-foreground"
                          } ${!isReachable ? "opacity-70" : ""}`}
                        >
                          <s.icon className="h-4 w-4" />
                        </div>
                        <span
                          className={`text-[11px] leading-tight text-center transition-colors ${
                            isReachable
                              ? step === s.number
                                ? "text-foreground font-medium"
                                : "text-muted-foreground hover:text-foreground"
                              : "text-muted-foreground/70"
                          }`}
                        >
                          {t(s.labelKey)}
                        </span>
                      </button>
                      {i < steps.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 rounded-full mx-2 mt-[17px] transition-colors ${
                            step > s.number ? "bg-primary" : "bg-surface-2"
                          }`}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-1 pb-2">
              <div className="space-y-6">
              {/* ── Step 1: Scope + Name ── */}
              {step === 1 && (
                <div className="space-y-6">
                  {/* Destination banner */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("destinationLabel")}</p>
                    {!showDestPicker ? (
                      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                        destination === "team"
                          ? "bg-primary/5 border-primary/30"
                          : "bg-surface-1 border-border"
                      }`}>
                        <span className="text-base">{destination === "team" ? "👥" : "🔒"}</span>
                        <span className="flex-1 text-sm">
                          {destination === "team" && org
                            ? t("destinationTeam").replace("{{teamName}}", org.name)
                            : t("destinationPersonal")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowDestPicker(true)}
                          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          {t("destinationChangeLink")}
                        </button>
                      </div>
                    ) : (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => { setDestination("personal"); setShowDestPicker(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface-1 transition-colors border-b border-border ${
                            destination === "personal" ? "bg-surface-1" : ""
                          }`}
                        >
                          <span>🔒</span>
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Personal</p>
                            <p className="text-sm font-medium">{t("destinationPersonal")}</p>
                          </div>
                          {destination === "personal" && <span className="text-primary text-xs">✓</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (org) { setDestination("team"); setShowDestPicker(false); } }}
                          disabled={!org}
                          className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${
                            !org ? "opacity-40 cursor-not-allowed" : "hover:bg-surface-1"
                          } ${destination === "team" ? "bg-surface-1" : ""}`}
                        >
                          <span>👥</span>
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Team</p>
                            <p className="text-sm font-medium">
                              {org
                                ? t("destinationTeam").replace("{{teamName}}", org.name)
                                : t("destinationNoTeamHint")}
                            </p>
                          </div>
                          {destination === "team" && <span className="text-primary text-xs">✓</span>}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-base font-medium text-foreground">{t("scopeStepTitle")}</p>
                    <p className="text-sm text-muted-foreground">{t("contextEditableLater")}</p>

                    {FEATURE_DRIVE_NOTION_IMPORT && (
                      <button
                        type="button"
                        onClick={() => setSetupMode("import")}
                        className="inline-flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
                      >
                        <CloudDownload className="h-3.5 w-3.5" />
                        <span>{t("importContextLink")}</span>
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: scope selector tile rounded-lg border-2 p-4 with icon+title+desc; Button primitive (h-10 rounded-md) would conflict with tile layout */}
                      <button
                        type="button"
                        onClick={() => setProjectScope("whole")}
                        className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          projectScope === "whole" ? "border-primary bg-primary/10" : "border-border bg-surface-1 hover:border-primary/50"
                        }`}
                      >
                        <Box className="h-4 w-4 shrink-0 text-primary" />
                        <div>
                          <span className="text-sm font-medium text-foreground">{t("scopeWholeProduct")}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{t("scopeWholeProductDesc")}</p>
                        </div>
                      </button>
                      {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: scope selector tile rounded-lg border-2 p-4 with icon+title+desc; Button primitive (h-10 rounded-md) would conflict with tile layout */}
                      <button
                        type="button"
                        onClick={() => setProjectScope("section")}
                        className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          projectScope === "section" ? "border-primary bg-primary/10" : "border-border bg-surface-1 hover:border-primary/50"
                        }`}
                      >
                        <LayoutGrid className="h-4 w-4 shrink-0 text-primary" />
                        <div>
                          <span className="text-sm font-medium text-foreground">{t("scopeSection")}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{t("scopeSectionDesc")}</p>
                        </div>
                      </button>
                    </div>
                    {!projectScope && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        {t("selectScopeHint")}
                      </p>
                    )}
                  </div>

                  {projectScope && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200 pt-1">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-medium">
                          {projectScope === "section" ? t("whatsSectionCalled") : t("whatsYourProjectCalled")}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {projectScope === "section" ? t("giveSectionName") : t("giveProjectName")}
                        </p>
                        <Input
                          id="name"
                          placeholder={projectScope === "section" ? t("sectionNamePlaceholder") : t("projectNamePlaceholder")}
                          value={formData.name}
                          onChange={(e) => handleChange("name", e.target.value)}
                          className="bg-surface-1 border-border"
                          autoFocus
                          maxLength={100}
                        />
                        <p className="text-xs text-muted-foreground text-right mt-1">{formData.name.length}/100</p>
                      </div>
                      {projectScope === "section" && (
                        <div className="space-y-3 pt-1">
                          <Label className="text-sm font-medium">{t("productName")}</Label>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => { setProductSource("new"); setSelectedProductId(null); handleChange("productName", ""); }}
                              className={`px-3 py-1.5 rounded-lg text-sm transition-all border-2 ${
                                productSource === "new" ? "border-primary bg-primary/10" : "border-border bg-surface-1 hover:border-primary/50"
                              }`}
                            >
                              {t("productSourceNew")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setProductSource("existing")}
                              className={`px-3 py-1.5 rounded-lg text-sm transition-all border-2 ${
                                productSource === "existing" ? "border-primary bg-primary/10" : "border-border bg-surface-1 hover:border-primary/50"
                              }`}
                            >
                              {t("productSourceExisting")}
                            </button>
                          </div>
                          {productSource === "new" && (
                            <>
                              <Input
                                id="product-name"
                                placeholder={t("projectNamePlaceholder")}
                                value={formData.productName}
                                onChange={(e) => handleChange("productName", e.target.value)}
                                className="bg-surface-1 border-border"
                                maxLength={100}
                              />
                              <p className="text-xs text-muted-foreground mt-1">{t("productNameSectionHint")}</p>
                            </>
                          )}
                          {productSource === "existing" && (
                            <div>
                              <Select
                                value={selectedProductId ?? ""}
                                onValueChange={async (projectId) => {
                                  if (!projectId) return;
                                  const option = productOptions.find((o) => o.projectId === projectId);
                                  if (option) {
                                    setSelectedProductId(projectId);
                                    handleChange("productName", option.name);
                                    setIsLoadingTemplate(true);
                                    try {
                                      const template = await getTemplateForProduct(projectId);
                                      if (template) {
                                        handleChange("globalMission", template.globalMission);
                                        handleChange("constraints", template.constraints);
                                        setPersonas(template.personas.length > 0 ? template.personas : [{ name: t("presetAverageUserName"), description: t("presetAverageUserDescription") }]);
                                      }
                                    } finally {
                                      setIsLoadingTemplate(false);
                                    }
                                  }
                                }}
                                disabled={productOptions.length === 0}
                              >
                                <SelectTrigger className="bg-surface-1 border-border">
                                  <SelectValue placeholder={t("chooseExistingProduct")} />
                                </SelectTrigger>
                                <SelectContent modal={false}>
                                  {productOptions.map((o) => (
                                    <SelectItem key={o.projectId} value={o.projectId}>{o.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {isLoadingTemplate && (
                                <p role="status" aria-live="polite" aria-busy="true" className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />{t("loadingTemplate")}
                                </p>
                              )}
                              {productOptions.length === 0 && (
                                <p className="text-xs text-muted-foreground mt-2">{t("noExistingProducts")}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 2: Mission ── */}
              {step === 2 && (
                <div className="space-y-6">
                  {projectScope === "section" && (
                    <div className="space-y-2">
                      <Label htmlFor="global-mission" className="text-sm font-medium">
                        {t("globalMissionLabel")}
                      </Label>
                      <p className="text-sm text-muted-foreground">{t("globalMissionHint")}</p>
                      <Textarea
                        id="global-mission"
                        placeholder={t("missionPlaceholder")}
                        value={formData.globalMission}
                        onChange={(e) => handleChange("globalMission", e.target.value)}
                        className="bg-surface-1 border-border min-h-24 resize-none"
                        autoFocus
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground text-right mt-1">{formData.globalMission.length}/500</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="mission" className="text-sm font-medium">
                      {projectScope === "section" ? t("whatsSectionMission") : t("whatsProductMission")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {projectScope === "section" ? t("describeWhySection") : t("describeWhy")}
                    </p>
                    <Textarea
                      id="mission"
                      placeholder={projectScope === "section" ? t("missionPlaceholderSection") : t("missionPlaceholder")}
                      value={formData.mission}
                      onChange={(e) => handleChange("mission", e.target.value)}
                      className="bg-surface-1 border-border min-h-32 resize-none"
                      autoFocus={projectScope !== "section"}
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground text-right mt-1">{formData.mission.length}/500</p>
                  </div>
                </div>
              )}

              {/* ── Step 3: Personas (pre-filled with Average User) ── */}
              {step === 3 && (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">{t("describePersona")}</p>

                  <div className="space-y-3">
                    <Label className="text-sm text-muted-foreground">{t("quickPresets")}</Label>
                    <div className="grid grid-cols-2 gap-4">
                      {ARCHETYPE_PRESETS.map((preset) => {
                        const presetName = t(preset.nameKey);
                        const presetDescription = t(preset.descriptionKey);
                        const isActive = personas.some((p) => p.name === presetName);
                        return (
                          // eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: persona archetype tile p-4 rounded-lg border-2 with icon+name+description; checkbox indicator inset; Button primitive (h-10 rounded-md) would conflict
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              if (isActive) {
                                // Deselect: remove this preset's persona from the list
                                const remaining = personas.filter((p) => p.name !== presetName);
                                // Always keep at least one (empty) slot so the form isn't blank
                                setPersonas(remaining.length > 0 ? remaining : [{ name: "", description: "" }]);
                              } else {
                                // Select: replace a blank slot if one exists, otherwise append
                                const blankIndex = personas.findIndex((p) => !p.name.trim() && !p.description.trim());
                                if (blankIndex !== -1) {
                                  const next = [...personas];
                                  next[blankIndex] = { name: presetName, description: presetDescription };
                                  setPersonas(next);
                                } else {
                                  setPersonas([...personas, { name: presetName, description: presetDescription }]);
                                }
                              }
                            }}
                            className={`relative group p-4 rounded-lg border-2 transition-all text-left ${
                              isActive
                                ? "border-primary bg-primary/15 text-foreground"
                                : "border-border bg-surface-1 hover:border-primary/50 hover:bg-surface-2"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <preset.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-primary"}`} />
                              <span className={`text-sm font-medium transition-colors ${isActive ? "text-primary" : "text-foreground group-hover:text-primary"}`}>
                                {t(preset.titleKey)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{t(preset.subtitleKey)}</p>
                            {/* Checkbox indicator */}
                            <span
                              className={`absolute right-3 top-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                isActive ? "border-primary bg-primary" : "border-border bg-background"
                              }`}
                            >
                              {isActive && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <PersonaManager personas={personas} onChange={setPersonas} disabled={createProject.isPending} />
                </div>
              )}

              {/* ── Step 4: Details (optional — accordion) ── */}
              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground italic">{t("detailsStepHint")}</p>

                  <Accordion type="multiple" className="w-full">
                    {/* Constraints */}
                    <AccordionItem value="constraints" className="border-border">
                      <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          {t("anyConstraints")}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">{t("accessibilityStandard")}</Label>
                            <Select value={selectedCompliance} onValueChange={setSelectedCompliance}>
                              <SelectTrigger className="bg-surface-1 border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent modal={false} className="bg-popover border-border">
                                {ACCESSIBILITY_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">{t("targetDevice")}</Label>
                            <div className="flex flex-wrap gap-2">
                              {PLATFORM_OPTIONS.map(opt => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => togglePlatform(opt.value)}
                                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                                    selectedPlatforms.includes(opt.value)
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-surface-1 text-muted-foreground border-border hover:border-primary/50"
                                  }`}
                                >
                                  {t(opt.labelKey)}
                                </button>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">{t("targetDeviceHelp")}</p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">{t("designSystem")}</Label>
                            <Select value={selectedDesignSystem} onValueChange={setSelectedDesignSystem}>
                              <SelectTrigger className="bg-surface-1 border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent modal={false} className="bg-popover border-border">
                                {DESIGN_SYSTEM_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="constraints" className="text-sm text-muted-foreground">{t("additionalConstraints")}</Label>
                            <Textarea
                              id="constraints"
                              placeholder={t("constraintsPlaceholder")}
                              value={formData.constraints}
                              onChange={(e) => handleChange("constraints", e.target.value)}
                              className="bg-surface-1 border-border min-h-20 resize-none"
                              maxLength={200}
                            />
                            <p className="text-xs text-muted-foreground text-right">{formData.constraints.length}/200</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Context Documents */}
                    <AccordionItem value="context" className="border-border">
                      <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                        <span className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          {t("additionalContextStep")}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">
                            {projectScope === "section" ? t("additionalContextDescSection") : t("additionalContextDesc")}
                          </p>
                          <ContextFileUpload
                            files={contextFiles}
                            onChange={setContextFiles}
                            disabled={createProject.isPending}
                            onExtractingChange={setContextExtracting}
                          />
                          {FEATURE_DRIVE_NOTION_IMPORT && (
                            <>
                              <div className="flex items-center gap-3 my-2">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-xs text-muted-foreground">{t("linkInputOr")}</span>
                                <div className="flex-1 h-px bg-border" />
                              </div>
                              <DocumentLinkInput
                                maxLinks={5}
                                onFetchClicked={handleManualLinkFetch}
                                disabled={fetchDocuments.isPending}
                                loadingLabel={t("importFetching")}
                              />
                              {pendingLinkDocs.length > 0 && (
                                <div className="mt-2 space-y-1.5">
                                  <p className="text-xs text-muted-foreground">
                                    {pendingLinkDocs.length} document{pendingLinkDocs.length !== 1 ? "s" : ""} fetched
                                  </p>
                                  {pendingLinkDocs.map((doc, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-surface-1/80 px-3 py-2 text-xs">
                                      <span className="truncate text-foreground">{doc.name}</span>
                                      <button
                                        type="button"
                                        onClick={() => setPendingLinkDocs((prev) => prev.filter((_, idx) => idx !== i))}
                                        className="text-muted-foreground hover:text-red-400 transition-colors ml-2"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Report Language */}
                    <AccordionItem value="language" className="border-b-0">
                      <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                        <span className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-muted-foreground" />
                          {t("reportLanguage")}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground mb-2">{t("chooseReportLanguage")}</p>
                          <Select value={formData.language} onValueChange={(value) => handleChange("language", value)}>
                            <SelectTrigger className="bg-surface-1 border-border">
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                            <SelectContent modal={false} className="bg-popover border-border">
                              <SelectItem value="system">{t("languageSystem")}</SelectItem>
                              <SelectItem value="English">English</SelectItem>
                              <SelectItem value="Italian">Italian</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}
              </div>
            </div>

            <div className="flex flex-shrink-0 justify-between mt-6 pt-5 border-t border-border">
              <Button
                variant="ghost"
                onClick={step === 1 ? () => onOpenChange(false) : handleBack}
                className="text-muted-foreground"
              >
                {step === 1 ? t("cancel") : t("back")}
              </Button>
              
              <div className="flex gap-2">
                {step === 3 && (
                  <Button
                    variant="ghost"
                    onClick={handleSubmit}
                    disabled={createProject.isPending || contextExtracting}
                    className="text-muted-foreground text-sm"
                  >
                    {t("skipDetailsCreate")}
                  </Button>
                )}
                {step < TOTAL_STEPS ? (
                  <Button
                    onClick={handleNext}
                    disabled={!canContinue() || contextExtracting}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {t("continue")}
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={createProject.isPending || contextExtracting}
                    className="bg-primary hover:bg-primary/90 glow-purple"
                    aria-busy={createProject.isPending}
                    title={contextExtracting ? t("extractingText") : undefined}
                  >
                    {createProject.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      t("createProject")
                    )}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewProjectDialog;
