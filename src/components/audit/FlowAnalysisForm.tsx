import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, Figma, Link, ArrowLeft, Images, X, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { invokeFigmaSnapshot, invokeFigmaFlow } from "@/services/integration.service";
import { clickableProps } from "@/lib/a11y";
import { toast } from "@/components/ui/sonner";
import AuditContextFields from "./AuditContextFields";
import type { UploadPersona } from "@/types/audit";
import { useIntegrationStatus, useInitiateOAuth } from "@/hooks/use-integrations";
import { PluginCTABanner } from "@/components/PluginCTABanner";
import { FigmaPluginCTA } from "./FigmaPluginCTA";
import { ProviderOverrideChip } from "./ProviderOverrideChip";
import { ModelOverrideChip } from "./ModelOverrideChip";
import { useUserAuditCapability } from "@/hooks/use-user-audit-capability";
import { useLlmKeys } from "@/hooks/use-llm-keys";
import { DEFAULT_MODEL_BY_PROVIDER } from "@/lib/llm-defaults";
import type { LLMProvider } from "@/services/llm-key.service";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableFlowThumbnail from "./SortableFlowThumbnail";

const MAX_FLOW_IMAGES = 10;
const FIGMA_SNAPSHOT_TIMEOUT_MS = 45_000;
const FIGMA_SNAPSHOT_MAX_RETRIES = 2;

interface FileWithId {
  id: string;
  file: File;
}

interface FlowAnalysisFormProps {
  personas: UploadPersona[];
  onFlowUpload: (files: File[], selectedPersonas: UploadPersona[], screenContext: string, userData?: string, synthPersonaIds?: string[], reauditUserNote?: string, provider?: LLMProvider, model?: string) => void;
  onBack: () => void;
  uploading: boolean;
  /** Pre-fill flow goal (e.g. when re-auditing from a previous audit) */
  initialScreenContext?: string;
  /** Pre-fill user data (e.g. when re-auditing from a previous audit), only if it was set before */
  initialUserData?: string;
  /** Pre-select synth personas (e.g. when re-auditing an audit that had synth analysis) */
  initialSynthPersonaIds?: string[];
  /** When true, show simplified re-audit modal (strip inherited fields, add note textarea) */
  isReauditFlow?: boolean;
}

interface NodeMetadata {
  nodeId: string;
  name: string;
  type: string;
}

const FlowAnalysisForm = ({
  personas,
  onFlowUpload,
  onBack,
  uploading,
  initialScreenContext,
  initialUserData,
  initialSynthPersonaIds,
  isReauditFlow,
}: FlowAnalysisFormProps) => {
  const { t } = useLanguage();
  const { session } = useAuth();
  const { data: cap } = useUserAuditCapability();
  const { data: keys = [] } = useLlmKeys();
  const defaultProvider: LLMProvider | undefined = cap?.kind === "byok" ? cap.provider : undefined;
  const [providerOverride, setProviderOverride] = useState<LLMProvider | null>(null);
  const activeProvider = providerOverride ?? defaultProvider;
  const [modelOverride, setModelOverride] = useState<string | null>(null);

  const savedOverrideFor = (p: LLMProvider): string | null =>
    keys.find((k) => k.provider === p)?.model_override ?? null;

  const activeModel = activeProvider
    ? (modelOverride ?? (savedOverrideFor(activeProvider) ?? DEFAULT_MODEL_BY_PROVIDER[activeProvider]))
    : null;

  const handleProviderChange = (p: LLMProvider) => {
    setProviderOverride(p);
    setModelOverride(null);
  };
  const [activeTab, setActiveTab] = useState<"upload" | "figma">("upload");
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [screenContext, setScreenContext] = useState(initialScreenContext ?? "");
  const [userData, setUserData] = useState(initialUserData ?? "");

  const [reauditUserNote, setReauditUserNote] = useState("");

  // Synth user state
  const [synthEnabled, setSynthEnabled] = useState(() => !!initialSynthPersonaIds?.length);
  const [selectedSynthIds, setSelectedSynthIds] = useState<string[]>(() => initialSynthPersonaIds ?? []);
  const toggleSynthId = useCallback((id: string) => {
    setSelectedSynthIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  // Upload tab state - multiple files with unique IDs for dnd-kit
  const [filesWithIds, setFilesWithIds] = useState<FileWithId[]>([]);
  const [dragActive, setDragActive] = useState(false);
  
  // Derive selectedFiles from filesWithIds for API compatibility
  const selectedFiles = useMemo(() => filesWithIds.map(f => f.file), [filesWithIds]);
  
  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Figma connection status via OAuth
  const { data: integrationStatus, isLoading: checkingIntegrations } = useIntegrationStatus();
  const initiateOAuth = useInitiateOAuth();
  const figmaConnected = integrationStatus?.figma ?? false;

  const [figmaSectionUrl, setFigmaSectionUrl] = useState("");
  const [figmaLoading, setFigmaLoading] = useState(false);
  
  // Progress state for client-side orchestration + ETA
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importStartedAt, setImportStartedAt] = useState<number | null>(null);
  const [importTick, setImportTick] = useState(0);
  const abortImportRef = useRef(false);

  // Tick every second during Figma import so ETA text updates
  useEffect(() => {
    if (!figmaLoading || !importStartedAt || importProgress.total === 0) return;
    const id = setInterval(() => setImportTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [figmaLoading, importStartedAt, importProgress.total]);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      addFiles(newFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const remaining = MAX_FLOW_IMAGES - filesWithIds.length;
    if (remaining <= 0) {
      toast.error(t("maxFlowImagesReached"));
      return;
    }
    const toAdd = newFiles.slice(0, remaining).map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
    }));
    setFilesWithIds(prev => [...prev, ...toAdd]);
    
    if (newFiles.length > remaining) {
      toast.warning(t("maxFlowImagesReached"));
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).filter(
        f => f.type.startsWith("image/")
      );
      addFiles(newFiles);
    }
  };

  const removeFile = (index: number) => {
    setFilesWithIds(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setFilesWithIds((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const togglePersona = (personaId: string) => {
    setSelectedPersonaIds((prev) =>
      prev.includes(personaId)
        ? prev.filter((id) => id !== personaId)
        : [...prev, personaId]
    );
  };

  const handleSubmitFlow = () => {
    if (selectedFiles.length < 2) return;
    const selectedPersonas = personas.filter((p) =>
      selectedPersonaIds.includes(p.id)
    );
    onFlowUpload(selectedFiles, selectedPersonas, screenContext, userData.trim() || undefined, synthEnabled && selectedSynthIds.length > 0 ? selectedSynthIds : undefined, reauditUserNote.trim() || undefined, activeProvider ?? undefined, activeModel ?? undefined);
  };

  const handleSubmitFigmaFlow = async () => {
    if (!figmaSectionUrl || !figmaConnected) return;

    if (!session) {
      toast.error(t("sessionExpired"));
      return;
    }

    setFigmaLoading(true);
    setImportProgress({ current: 0, total: 0 });
    setImportStartedAt(null);
    abortImportRef.current = false;

    try {
      const metadataResponse = await invokeFigmaFlow(figmaSectionUrl);

      const metadataData = metadataResponse.data;

      if (metadataData?.error === "TOKEN_EXPIRED") {
        toast.error(t("figmaConnectionExpired"));
        return;
      }

      if (metadataResponse.error || !metadataData?.success) {
        const message = metadataData?.message || metadataResponse.error?.message || t("figmaImportFailed");
        toast.error(message);
        return;
      }

      const { fileKey, nodes } = metadataData as { fileKey: string; nodes: NodeMetadata[] };

      if (!nodes || nodes.length === 0) {
        toast.error("No frames found in this section");
        return;
      }

      setImportProgress({ current: 0, total: nodes.length });
      setImportStartedAt(Date.now());

      const results: { imageUrl: string; storagePath: string; name: string }[] = [];
      let lastErrorMessage: string | null = null;

      for (let i = 0; i < nodes.length; i++) {
        if (abortImportRef.current) break;

        const node = nodes[i];
        setImportProgress({ current: i + 1, total: nodes.length });

        const nodeUrl = `https://www.figma.com/design/${fileKey}?node-id=${encodeURIComponent(node.nodeId)}`;

        let lastError: unknown = null;
        for (let attempt = 1; attempt <= FIGMA_SNAPSHOT_MAX_RETRIES; attempt++) {
          try {
            const snapshotPromise = invokeFigmaSnapshot(nodeUrl);
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), FIGMA_SNAPSHOT_TIMEOUT_MS)
            );
            const snapshotResponse = await Promise.race([snapshotPromise, timeoutPromise]);
            const snapshotData = snapshotResponse.data;

            if (snapshotData?.error === "TOKEN_EXPIRED") {
              toast.error(t("figmaConnectionExpired"));
              setFigmaLoading(false);
              setImportProgress({ current: 0, total: 0 });
              setImportStartedAt(null);
              return;
            }

            if (snapshotResponse.error || !snapshotData?.success) {
              if (snapshotResponse.error?.context?.json) {
                try {
                  const body = await snapshotResponse.error.context.json() as { message?: string; error?: string };
                  lastErrorMessage = body?.message ?? body?.error ?? snapshotResponse.error?.message ?? null;
                } catch {
                  lastErrorMessage = snapshotResponse.error?.message ?? snapshotData?.message ?? null;
                }
              } else {
                lastErrorMessage =
                  (snapshotData?.message as string) ??
                  (snapshotResponse.error as Error)?.message ??
                  String(snapshotResponse.error ?? "Unknown error");
              }
              lastError = lastErrorMessage;
              continue;
            }

            results.push({
              imageUrl: snapshotData.imageUrl,
              storagePath: snapshotData.storagePath,
              name: node.name,
            });
            lastError = null;
            lastErrorMessage = null;
            break;
          } catch (err) {
            lastError = err;
            lastErrorMessage = err instanceof Error ? err.message : String(err);
            if (attempt < FIGMA_SNAPSHOT_MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
        }
        if (lastError) {
          console.error(`Failed to import screen ${i + 1}:`, lastErrorMessage ?? lastError);
        }
        // Small delay between frames to reduce Figma API rate limiting
        if (i < nodes.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      const cancelled = abortImportRef.current;
      if (cancelled) {
        if (results.length >= 2) {
          toast.info(t("flowImportCancelledPartial").replace("{count}", String(results.length)).replace("{total}", String(nodes.length)));
          const selectedPersonas = personas.filter((p) => selectedPersonaIds.includes(p.id));
          const flowContext = `[FIGMA_FLOW_DATA:${JSON.stringify({
            urls: results.map((r) => r.imageUrl),
            paths: results.map((r) => r.storagePath),
          })}]\n${screenContext}`;
          onFlowUpload([], selectedPersonas, flowContext, userData.trim() || undefined, synthEnabled && selectedSynthIds.length > 0 ? selectedSynthIds : undefined, reauditUserNote.trim() || undefined, activeProvider ?? undefined, activeModel ?? undefined);
        } else {
          toast.info(t("flowImportCancelledNeedTwo"));
        }
        return;
      }

      if (results.length === 0) {
        if (lastErrorMessage) {
          console.error("Figma flow import: last error:", lastErrorMessage);
          const isOldRateLimit =
            /moving too fast|1 call\/10min|Paid accounts allow|Free accounts are slower|6 API calls per month|rate limit/i.test(lastErrorMessage);
          const displayMessage = isOldRateLimit ? t("figmaRateLimitMessage") : lastErrorMessage;
          toast.error(
            lastErrorMessage.length > 120 && !isOldRateLimit
              ? `${t("figmaImportAllFramesFailed")} (${lastErrorMessage.slice(0, 120)}…)`
              : `${t("figmaImportAllFramesFailed")} ${displayMessage}`,
            { duration: 15000 }
          );
        } else {
          toast.error(t("figmaImportAllFramesFailed") ?? t("figmaImportFailed"), { duration: 15000 });
        }
        return;
      }

      const selectedPersonas = personas.filter((p) =>
        selectedPersonaIds.includes(p.id)
      );

      if (results.length < nodes.length) {
        toast.warning(
          t("figmaFlowImportPartial").replace("{count}", String(results.length)).replace("{total}", String(nodes.length)),
          { duration: 15000 }
        );
      } else {
        toast.success(t("figmaFlowImported").replace("{count}", results.length.toString()));
      }

      const flowContext = `[FIGMA_FLOW_DATA:${JSON.stringify({
        urls: results.map((r) => r.imageUrl),
        paths: results.map((r) => r.storagePath),
      })}]\n${screenContext}`;

      onFlowUpload(
        [],
        selectedPersonas,
        flowContext,
        userData.trim() || undefined,
        synthEnabled && selectedSynthIds.length > 0 ? selectedSynthIds : undefined,
        reauditUserNote.trim() || undefined,
        activeProvider ?? undefined,
        activeModel ?? undefined
      );
    } catch (error) {
      console.error("Figma flow import error:", error);
      toast.error(t("figmaImportFailed"), { duration: 15000 });
    } finally {
      setFigmaLoading(false);
      setImportProgress({ current: 0, total: 0 });
      setImportStartedAt(null);
    }
  };

  const handleCancelFigmaImport = () => {
    abortImportRef.current = true;
  };

  const isLoading = uploading || figmaLoading;
  const canSubmitFlow = selectedFiles.length >= 2 && !isLoading;
  const canSubmitFigmaFlow = !!figmaSectionUrl && figmaConnected && !isLoading;

  return (
    <div className="flex flex-col h-full min-h-0">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "figma")} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
          <TabsTrigger value="upload" className="gap-2">
            <Images className="h-4 w-4" />
            {t("uploadImages")}
          </TabsTrigger>
          <TabsTrigger value="figma" className="gap-2">
            <Figma className="h-4 w-4" />
            {t("figmaSection")}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto py-4 pr-1 min-h-0">
          <TabsContent value="upload" className="mt-0 space-y-4 data-[state=inactive]:hidden">
            {/* Multi-file Drop Zone */}
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- clickableProps() spreads role + tabIndex + onKeyDown */}
            <div
              data-tour="upload-area"
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                dragActive
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              // eslint-disable-next-line no-restricted-syntax -- REACT-004: hidden file-input + .click() is the canonical pattern for custom upload UX
              {...clickableProps(() => document.getElementById("flow-file-upload")?.click())}
            >
              <input
                id="flow-file-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                aria-label="Upload flow screenshots"
                onChange={handleFilesChange}
                className="hidden"
              />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t("dragAndDropMultiple")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("maxFlowImages")}
              </p>
            </div>

            {/* Sortable Thumbnail Strip */}
            {filesWithIds.length > 0 && (
              <div className="space-y-2">
                <Label>{t("flowSteps")} ({filesWithIds.length}/{MAX_FLOW_IMAGES}) <span className="text-xs text-muted-foreground font-normal ml-1">— drag to reorder</span></Label>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={filesWithIds.map(f => f.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {filesWithIds.map((fileWithId, index) => (
                        <SortableFlowThumbnail
                          key={fileWithId.id}
                          id={fileWithId.id}
                          file={fileWithId.file}
                          index={index}
                          onRemove={removeFile}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* CTA A: subtle plugin hint for users on the upload tab */}
            {!isReauditFlow && (
              <PluginCTABanner
                variant="subtle"
                storageKey="plugin_cta_flow_upload_tab_dismissed"
              />
            )}

            {isReauditFlow ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t("reauditUserNoteLabel")}</Label>
                    <span className="text-xs text-muted-foreground bg-surface-1 border border-border rounded px-1.5 py-0.5">{t("optional")}</span>
                  </div>
                  <Textarea
                    value={reauditUserNote}
                    onChange={(e) => setReauditUserNote(e.target.value.slice(0, 1000))}
                    placeholder={t("reauditUserNotePlaceholder")}
                    className="bg-surface-1 border-border resize-none"
                    rows={2}
                  />
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3 w-3 shrink-0" />
                  {t("reauditContextInherited")}
                </p>
              </div>
            ) : (
              <AuditContextFields
                screenContext={screenContext}
                onScreenContextChange={setScreenContext}
                screenContextLabel={t("flowGoalLabel")}
                screenContextPlaceholder={t("flowContextPlaceholder")}
                userData={userData}
                onUserDataChange={setUserData}
                personas={personas}
                selectedPersonaIds={selectedPersonaIds}
                onTogglePersona={togglePersona}
                synthUsers={{
                  enabled: synthEnabled,
                  onEnabledChange: setSynthEnabled,
                  selectedIds: selectedSynthIds,
                  onToggleId: toggleSynthId,
                }}
              />
            )}
          </TabsContent>

          <TabsContent value="figma" className="mt-0 space-y-4 data-[state=inactive]:hidden">
            {checkingIntegrations ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{t("checkingFigmaConnection")}</span>
              </div>
            ) : !figmaConnected ? (
              <div className="space-y-3">
                <div className="space-y-3 p-4 rounded-lg bg-surface-1 border border-border text-center">
                  <p className="text-sm text-muted-foreground">{t("figmaNotConnectedHint")}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => initiateOAuth.mutate({ provider: "figma" })}
                    disabled={initiateOAuth.isPending}
                    className="gap-2"
                  >
                    {initiateOAuth.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Figma className="h-4 w-4" />}
                    {t("connectFigma")}
                  </Button>
                </div>
                {/* CTA B: bold plugin card — user is clearly thinking about Figma */}
                <PluginCTABanner
                  variant="bold"
                  storageKey="plugin_cta_flow_figma_tab_dismissed"
                />
              </div>
            ) : (
              <>
                {/* Figma Section URL Input */}
                <div className="space-y-2">
                  <Label htmlFor="figma-section-url">{t("figmaSectionLink")}</Label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="figma-section-url"
                      type="url"
                      value={figmaSectionUrl}
                      onChange={(e) => setFigmaSectionUrl(e.target.value)}
                      placeholder="https://www.figma.com/file/.../section/..."
                      className="bg-surface-1 border-border pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("figmaSectionHint")}
                  </p>
                </div>

                {/* Subtle plugin hint when Figma is connected — different copy from upload tab */}
                <FigmaPluginCTA storageKey="plugin_cta_flow_figma_tab_connected_dismissed" />

                {/* Progress indicator with ETA and Cancel */}
                {importProgress.total > 0 && (
                  <div className="space-y-2 p-3 bg-surface-1 rounded-lg border border-border">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm text-muted-foreground">
                          {t("flowImportingStep").replace("{current}", String(importProgress.current)).replace("{total}", String(importProgress.total))}
                        </span>
                        {importStartedAt != null && importProgress.current >= 1 && importProgress.current < importProgress.total && (
                          <span className="text-xs text-muted-foreground" key={importTick}>
                            {(() => {
                              const elapsed = (Date.now() - importStartedAt) / 1000;
                              const avgPerStep = elapsed / importProgress.current;
                              const remaining = importProgress.total - importProgress.current;
                              const etaSec = Math.round(avgPerStep * remaining);
                              if (etaSec < 60) return t("flowImportEtaSeconds").replace("{seconds}", String(etaSec));
                              const etaMin = Math.round(etaSec / 60);
                              return t("flowImportEtaMinutes").replace("{minutes}", String(etaMin));
                            })()}
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelFigmaImport}
                        disabled={!figmaLoading}
                        className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                        {t("flowImportCancel")}
                      </Button>
                    </div>
                    <Progress value={(importProgress.current / importProgress.total) * 100} className="h-2" />
                  </div>
                )}

                {isReauditFlow ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label>{t("reauditUserNoteLabel")}</Label>
                        <span className="text-xs text-muted-foreground bg-surface-1 border border-border rounded px-1.5 py-0.5">{t("optional")}</span>
                      </div>
                      <Textarea
                        value={reauditUserNote}
                        onChange={(e) => setReauditUserNote(e.target.value.slice(0, 1000))}
                        placeholder={t("reauditUserNotePlaceholder")}
                        className="bg-surface-1 border-border resize-none"
                        rows={2}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Info className="h-3 w-3 shrink-0" />
                      {t("reauditContextInherited")}
                    </p>
                  </div>
                ) : (
                  <AuditContextFields
                    screenContext={screenContext}
                    onScreenContextChange={setScreenContext}
                    screenContextLabel={t("flowGoalLabel")}
                    screenContextPlaceholder={t("flowContextPlaceholder")}
                    userData={userData}
                    onUserDataChange={setUserData}
                    personas={personas}
                    selectedPersonaIds={selectedPersonaIds}
                    onTogglePersona={togglePersona}
                  />
                )}
              </>
            )}
          </TabsContent>
        </div>
      </Tabs>

      <div className="flex justify-between gap-3 pt-4 border-t border-border flex-shrink-0">
        <Button
          variant="ghost"
          onClick={onBack}
          disabled={isLoading}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Button>

        <div className="flex flex-col items-end gap-1.5">
          {!screenContext.trim() && (activeTab === "upload" ? selectedFiles.length >= 2 : !!figmaSectionUrl) && (
            <p className="text-xs text-muted-foreground">{t("noGoalNudge")}</p>
          )}
          <div className="flex gap-3 items-center">
          {activeProvider && activeModel && (
            <>
              <ProviderOverrideChip value={activeProvider} onChange={handleProviderChange} />
              <ModelOverrideChip
                provider={activeProvider}
                value={activeModel}
                savedOverride={savedOverrideFor(activeProvider)}
                onChange={setModelOverride}
              />
            </>
          )}
          {activeTab === "upload" ? (
            <Button
              onClick={handleSubmitFlow}
              disabled={!canSubmitFlow}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("analyzing")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {t("analyzeFlow")} ({selectedFiles.length})
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSubmitFigmaFlow}
              disabled={!canSubmitFigmaFlow}
              className="gap-2"
            >
              {figmaLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {importProgress.total > 0 
                    ? `${importProgress.current}/${importProgress.total}` 
                    : t("importingFromFigma")}
                </>
              ) : (
                <>
                  <Figma className="h-4 w-4" />
                  {t("importSection")}
                </>
              )}
            </Button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowAnalysisForm;
