import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Loader2, Figma, Link, ArrowLeft, Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { invokeFigmaSnapshot } from "@/services/integration.service";
import { clickableProps } from "@/lib/a11y";
import { toast } from "@/components/ui/sonner";
import { type ContextImage } from "./ContextImageUploader";
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

export interface ContextImageData {
  file?: File;
  signedUrl?: string;
  storagePath?: string;
  source: "upload" | "figma";
}

interface SingleScreenFormProps {
  personas: UploadPersona[];
  onUpload: (file: File, selectedPersonas: UploadPersona[], screenContext: string, contextImages?: ContextImageData[], userData?: string, synthPersonaIds?: string[], reauditUserNote?: string, provider?: LLMProvider, model?: string) => void;
  onFigmaUpload?: (imageUrl: string, storagePath: string, selectedPersonas: UploadPersona[], screenContext: string, contextImages?: ContextImageData[], figmaNodeSummary?: unknown, deepFigmaUiRequested?: boolean, userData?: string, synthPersonaIds?: string[], reauditUserNote?: string, provider?: LLMProvider, model?: string) => void;
  onBack: () => void;
  uploading: boolean;
  defaultTab?: "upload" | "figma";
  initialFile?: File | null;
  onInitialFileClear?: () => void;
  /** Pre-fill screen goal (e.g. when re-auditing from a previous audit) */
  initialScreenContext?: string;
  /** Pre-fill user data (e.g. when re-auditing from a previous audit), only if it was set before */
  initialUserData?: string;
  /** Pre-select synth personas (e.g. when re-auditing an audit that had synth analysis) */
  initialSynthPersonaIds?: string[];
  /** When true, show simplified re-audit modal (strip inherited fields, add note textarea) */
  isReauditFlow?: boolean;
}

const ReauditNoteField = ({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: (key: string) => string }) => (
  <div className="space-y-3">
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>{t("reauditUserNoteLabel")}</Label>
        <span className="text-xs text-muted-foreground bg-surface-1 border border-border rounded px-1.5 py-0.5">{t("optional")}</span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 1000))}
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
);

const SingleScreenForm = ({
  personas,
  onUpload,
  onFigmaUpload,
  onBack,
  uploading,
  defaultTab = "upload",
  initialFile,
  onInitialFileClear,
  initialScreenContext,
  initialUserData,
  initialSynthPersonaIds,
  isReauditFlow,
}: SingleScreenFormProps) => {
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
  const [activeTab, setActiveTab] = useState<"upload" | "figma">(defaultTab);
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

  // Context images state
  const [contextImages, setContextImages] = useState<ContextImage[]>([]);
  
  // Upload tab state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Keep preview URL in sync with selected file and revoke previous URL to avoid leaks
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  // If parent provides an initial file (e.g. from a drag-and-drop on the project card),
  // adopt it into local state once and then notify parent so it can clear its reference.
  useEffect(() => {
    if (initialFile) {
      setSelectedFile(initialFile);
      onInitialFileClear?.();
    }
  }, [initialFile, onInitialFileClear]);
  
  // Figma connection status via OAuth
  const { data: integrationStatus, isLoading: checkingIntegrations } = useIntegrationStatus();
  const initiateOAuth = useInitiateOAuth();
  const figmaConnected = integrationStatus?.figma ?? false;

  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [deepFigmaUi, setDeepFigmaUi] = useState(true);

  const figmaUrlHasNodeId = (() => {
    if (!figmaUrl.trim()) return true;
    try {
      const u = new URL(figmaUrl.trim());
      if (u.searchParams.get("node-id")) return true;
      if (u.hash && /node-id=/.test(u.hash)) return true;
      return false;
    } catch {
      // intentional: malformed URL — don't block the form, let server-side validation catch it
      return true;
    }
  })();
  
  // Handler for context images
  const handleContextImagesChange = useCallback((images: ContextImage[]) => {
    setContextImages(images);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      e.dataTransfer.dropEffect = "copy";
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    let file: File | null = null;
    if (e.dataTransfer.files?.length) {
      file = e.dataTransfer.files[0];
    } else if (e.dataTransfer.items?.length) {
      const item = e.dataTransfer.items[0];
      if (item.kind === "file") {
        file = item.getAsFile();
      }
      // When dragging from another tab Chrome often gives a URL (text/uri-list), not a file
      if (!file && item.kind === "string" && item.type === "text/uri-list") {
        item.getAsString((urlString) => {
          const url = urlString?.trim?.();
          if (!url) return;
          const trimmed = url.split(/\r?\n/)[0]?.trim();
          if (!trimmed) return;

          // data: URL (e.g. from same-origin or canvas) — no fetch, no CORS
          if (trimmed.startsWith("data:")) {
            try {
              const [header, base64] = trimmed.split(",");
              const mime = header.match(/data:([^;]+)/)?.[1]?.trim() || "image/png";
              if (!mime.startsWith("image/")) {
                toast.error(t("invalidFormatError") || "Please drop an image (PNG, JPEG, or WebP).");
                return;
              }
              const bin = atob(base64);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const blob = new Blob([bytes], { type: mime });
              const ext = mime.replace("image/", "") || "png";
              const f = new File([blob], `dropped-image.${ext}`, { type: mime });
              setSelectedFile(f);
              toast.success(t("screenshotAdded") || "Screenshot added");
            } catch {
              // intentional: atob/Blob construction failed — surface to user via toast
              toast.error(t("dropFromTabNotSupported") || "This image can't be used. Save it to your device and drag it here, or use the file picker.");
            }
            return;
          }

          // https: URL — fetch (subject to CORS)
          fetch(trimmed, { mode: "cors", credentials: "omit" })
            .then((res) => {
              if (!res.ok) throw new Error("Fetch failed");
              return res.blob();
            })
            .then((blob) => {
              if (!blob.type.startsWith("image/")) {
                toast.error(t("invalidFormatError") || "Please drop an image (PNG, JPEG, or WebP).");
                return;
              }
              const ext = blob.type.replace("image/", "") || "png";
              const f = new File([blob], `dropped-image.${ext}`, { type: blob.type });
              setSelectedFile(f);
              toast.success(t("screenshotAdded") || "Screenshot added");
            })
            .catch(() => {
              toast.error(t("dropFromTabNotSupported") || "This image can't be used from another tab. Save it to your device and drag it here, or use the file picker.");
            });
        });
        return;
      }
    }

    // Fallback: try getData (sometimes available on drop)
    if (!file && e.dataTransfer.types.includes("text/uri-list")) {
      const uri = e.dataTransfer.getData("text/uri-list")?.split(/\r?\n/)[0]?.trim();
      if (uri) {
        if (uri.startsWith("data:")) {
          try {
            const [header, base64] = uri.split(",");
            const mime = header.match(/data:([^;]+)/)?.[1]?.trim() || "image/png";
            if (!mime.startsWith("image/")) {
              toast.error(t("invalidFormatError") || "Please drop an image (PNG, JPEG, or WebP).");
              return;
            }
            const bin = atob(base64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const blob = new Blob([bytes], { type: mime });
            const ext = mime.replace("image/", "") || "png";
            const f = new File([blob], `dropped-image.${ext}`, { type: mime });
            setSelectedFile(f);
            toast.success(t("screenshotAdded") || "Screenshot added");
          } catch {
            // intentional: atob/Blob construction failed — surface to user via toast
            toast.error(t("dropFromTabNotSupported") || "This image can't be used. Save it to your device and drag it here, or use the file picker.");
          }
          return;
        }
        fetch(uri, { mode: "cors", credentials: "omit" })
          .then((res) => {
            if (!res.ok) throw new Error("Fetch failed");
            return res.blob();
          })
          .then((blob) => {
            if (!blob.type.startsWith("image/")) {
              toast.error(t("invalidFormatError") || "Please drop an image (PNG, JPEG, or WebP).");
              return;
            }
            const ext = blob.type.replace("image/", "") || "png";
            const f = new File([blob], `dropped-image.${ext}`, { type: blob.type });
            setSelectedFile(f);
            toast.success(t("screenshotAdded") || "Screenshot added");
          })
          .catch(() => {
            toast.error(t("dropFromTabNotSupported") || "This image can't be used from another tab. Save it to your device and drag it here, or use the file picker.");
          });
        return;
      }
    }

    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      toast.success(t("screenshotAdded") || "Screenshot added");
    } else if (file) {
      toast.error(t("invalidFormatError") || "Please drop an image (PNG, JPEG, or WebP).");
    }
  };

  const togglePersona = (personaId: string) => {
    setSelectedPersonaIds((prev) =>
      prev.includes(personaId)
        ? prev.filter((id) => id !== personaId)
        : [...prev, personaId]
    );
  };

  const handleSubmitUpload = () => {
    if (!selectedFile) return;
    const selectedPersonas = personas.filter((p) =>
      selectedPersonaIds.includes(p.id)
    );
    const contextImageData: ContextImageData[] = contextImages
      .filter((img) => (img.source === "upload" && img.file) || (img.source === "figma" && img.signedUrl))
      .map((img) => ({
        file: img.file,
        signedUrl: img.signedUrl,
        storagePath: img.storagePath,
        source: img.source,
      }));
    onUpload(selectedFile, selectedPersonas, screenContext, contextImageData.length > 0 ? contextImageData : undefined, userData.trim() || undefined, synthEnabled && selectedSynthIds.length > 0 ? selectedSynthIds : undefined, reauditUserNote.trim() || undefined, activeProvider ?? undefined, activeModel ?? undefined);
  };

  const handleSubmitFigma = async () => {
    if (!figmaUrl || !figmaConnected) return;

    if (!session?.access_token) {
      toast.error(t("authRequiredError"));
      return;
    }

    setFigmaLoading(true);

    try {
      const { data, error } = await invokeFigmaSnapshot(figmaUrl, deepFigmaUi);

      if (error) {
        let message = error.message || "Failed to fetch Figma snapshot";
        try {
          const body = error.context && typeof error.context.json === "function" ? await error.context.json() : null;
          if (body?.message) message = body.message;
          if (body?.error === "RATE_LIMITED" || body?.error === "FIGMA_QUOTA_EXCEEDED") message = t("figmaRateLimitMessage");
          else if (/moving too fast|1 call\/10min|Paid accounts allow|Free accounts are slower|6 API calls per month/i.test(message))
            message = t("figmaRateLimitMessage");
        } catch {
          // intentional: error body not JSON — fall back to error.message extracted above
        }
        setFigmaLoading(false);
        toast.error(message, { duration: 15000 });
        return;
      }

      if (data && data.success === false && data.error === "TOKEN_EXPIRED") {
        toast.error(t("figmaConnectionExpired"));
        return;
      }

      if (!data || data.success === false) {
        throw new Error(data?.message || "Failed to fetch Figma snapshot");
      }

      const selectedPersonas = personas.filter((p) =>
        selectedPersonaIds.includes(p.id)
      );

      const contextImageData: ContextImageData[] = [];
      for (const img of contextImages) {
        if (img.source === "upload" && img.file) {
          contextImageData.push({ file: img.file, source: "upload" });
          continue;
        }
        if (img.source === "figma" && img.signedUrl && img.storagePath) {
          contextImageData.push({
            signedUrl: img.signedUrl,
            storagePath: img.storagePath,
            source: "figma",
          });
          continue;
        }
        if (img.source === "figma" && img.figmaContextUrl) {
          const snapshotRes = await invokeFigmaSnapshot(img.figmaContextUrl, false);
          if (snapshotRes.data?.success === false && snapshotRes.data?.error === "TOKEN_EXPIRED") {
            toast.error(t("figmaConnectionExpired"));
            return;
          }
          if (snapshotRes.error || !snapshotRes.data?.success) {
            let msg = snapshotRes.data?.message ?? t("figmaImportError");
            try {
              const body =
                snapshotRes.error?.context && typeof snapshotRes.error.context.json === "function"
                  ? await snapshotRes.error.context.json()
                  : null;
              if (body?.message) msg = body.message;
              if (body?.error === "RATE_LIMITED" || body?.error === "FIGMA_QUOTA_EXCEEDED") msg = t("figmaRateLimitMessage");
              else if (/moving too fast|1 call\/10min|Paid accounts allow|Free accounts are slower|6 API calls per month/i.test(msg))
                msg = t("figmaRateLimitMessage");
            } catch {
              // intentional: error body not JSON — fall back to msg extracted above
            }
            toast.error(msg, { duration: 15000 });
            return;
          }
          contextImageData.push({
            signedUrl: snapshotRes.data.imageUrl,
            storagePath: snapshotRes.data.storagePath,
            source: "figma",
          });
        }
      }

      if (onFigmaUpload) {
        onFigmaUpload(data.imageUrl, data.storagePath, selectedPersonas, screenContext, contextImageData.length > 0 ? contextImageData : undefined, data.figmaNodeSummary, deepFigmaUi, userData.trim() || undefined, synthEnabled && selectedSynthIds.length > 0 ? selectedSynthIds : undefined, reauditUserNote.trim() || undefined, activeProvider ?? undefined, activeModel ?? undefined);
      }

    } catch (error) {
      console.error("Figma import error:", error);
      let msg = error instanceof Error ? error.message : t("figmaImportError");
      if (/moving too fast|1 call\/10min|Paid accounts allow|Free accounts are slower|6 API calls per month|rate limit/i.test(msg))
        msg = t("figmaRateLimitMessage");
      toast.error(msg, { duration: 15000 });
    } finally {
      setFigmaLoading(false);
    }
  };

  const isLoading = uploading || figmaLoading;
  const canSubmitUpload = !!selectedFile && !isLoading;
  const canSubmitFigma = !!figmaUrl && figmaConnected && !isLoading;

  return (
    <div className="flex flex-col h-full min-h-0">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "figma")} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            {t("uploadTab")}
          </TabsTrigger>
          <TabsTrigger value="figma" className="gap-2">
            <Figma className="h-4 w-4" />
            {t("figmaTab")}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto py-4 pr-1 min-h-0">
          <TabsContent value="upload" className="mt-0 space-y-4 data-[state=inactive]:hidden">
            {/* Target Screen Label */}
            <Label className="text-sm font-medium">{t("targetScreenLabel")}</Label>
            
            {/* File Drop Zone with Image Preview */}
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- clickableProps() spreads role + tabIndex + onKeyDown */}
            <div
              data-tour="upload-area"
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                dragActive
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              // eslint-disable-next-line no-restricted-syntax -- REACT-004: hidden file-input + .click() is the canonical pattern for custom upload UX
              {...clickableProps(() => document.getElementById("file-upload")?.click())}
            >
              <input
                id="file-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Upload screenshot to analyze"
                onChange={handleFileChange}
                className="hidden"
              />
              {selectedFile && previewUrl ? (
                <div className="relative group">
                  <img
                    src={previewUrl}
                    alt="Main screenshot preview"
                    className="max-h-40 mx-auto rounded-md object-contain"
                  />
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {selectedFile.name}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t("dragAndDropHint")}
                  </p>
                </>
              )}
            </div>

            {/* CTA A: subtle plugin hint for users on the upload tab */}
            {!isReauditFlow && (
              <PluginCTABanner
                variant="subtle"
                storageKey="plugin_cta_upload_tab_dismissed"
              />
            )}

            {isReauditFlow ? (
              <ReauditNoteField value={reauditUserNote} onChange={setReauditUserNote} t={t} />
            ) : (
              <AuditContextFields
                screenContext={screenContext}
                onScreenContextChange={setScreenContext}
                screenContextLabel={t("screenGoalLabel")}
                userData={userData}
                onUserDataChange={setUserData}
                personas={personas}
                selectedPersonaIds={selectedPersonaIds}
                onTogglePersona={togglePersona}
                contextImages={{
                  onContextImagesChange: handleContextImagesChange,
                  disabled: isLoading,
                  figmaConnected,
                  checkingFigma: checkingIntegrations,
                  figmaContextAllowed: false,
                }}
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
                  storageKey="plugin_cta_figma_tab_dismissed"
                />
              </div>
            ) : (
              <>
                {/* Figma URL Input */}
                <div className="space-y-2">
                  <Label htmlFor="figma-url">{t("figmaScreenLinkLabel")}</Label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="figma-url"
                      type="url"
                      value={figmaUrl}
                      onChange={(e) => setFigmaUrl(e.target.value)}
                      placeholder="https://www.figma.com/file/..."
                      className="bg-surface-1 border-border pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("figmaUrlHint")}
                  </p>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-border p-3 bg-muted/30">
                  <Checkbox
                    id="deep-figma-ui"
                    checked={deepFigmaUi}
                    onCheckedChange={(checked) => setDeepFigmaUi(checked === true)}
                    className="mt-[0.2rem] shrink-0"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="deep-figma-ui" className="text-sm font-medium cursor-pointer leading-tight">
                      {t("figmaDeepUiLabel")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("figmaDeepUiEnrichNote")}
                    </p>
                    {deepFigmaUi && !figmaUrlHasNodeId && figmaUrl.trim() && (
                      <p className="text-xs text-amber-200/80">
                        {t("figmaNoNodeIdHint")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Subtle plugin hint when Figma is connected — different copy from upload tab */}
                <FigmaPluginCTA />

                {isReauditFlow ? (
                  <ReauditNoteField value={reauditUserNote} onChange={setReauditUserNote} t={t} />
                ) : (
                  <AuditContextFields
                    screenContext={screenContext}
                    onScreenContextChange={setScreenContext}
                    screenContextLabel={t("screenGoalLabel")}
                    userData={userData}
                    onUserDataChange={setUserData}
                    personas={personas}
                    selectedPersonaIds={selectedPersonaIds}
                    onTogglePersona={togglePersona}
                    contextImages={{
                      onContextImagesChange: handleContextImagesChange,
                      disabled: isLoading,
                      figmaConnected,
                      checkingFigma: checkingIntegrations,
                    }}
                    synthUsers={{
                      enabled: synthEnabled,
                      onEnabledChange: setSynthEnabled,
                      selectedIds: selectedSynthIds,
                      onToggleId: toggleSynthId,
                    }}
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
          {!screenContext.trim() && (activeTab === "upload" ? !!selectedFile : !!figmaUrl) && (
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
              onClick={handleSubmitUpload}
              disabled={!canSubmitUpload}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("uploading")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {t("auditButton")}
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSubmitFigma}
              disabled={!canSubmitFigma}
              className="gap-2"
            >
              {figmaLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("importingFromFigma")}
                </>
              ) : (
                <>
                  <Figma className="h-4 w-4" />
                  {t("importFromFigma")}
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

export default SingleScreenForm;
