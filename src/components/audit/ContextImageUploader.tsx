import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Loader2, Figma, Link, X, Image as ImageIcon, Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { clickableProps } from "@/lib/a11y";
import { toast } from "@/components/ui/sonner";

interface ContextImage {
  id: string;
  file?: File;
  previewUrl: string;
  signedUrl?: string;
  storagePath?: string;
  source: "upload" | "figma";
  /** When set without signedUrl, this context is fetched on global Import & Analyze */
  figmaContextUrl?: string;
}

interface ContextImageUploaderProps {
  onContextImagesChange: (images: ContextImage[]) => void;
  disabled?: boolean;
  figmaConnected: boolean;
  checkingFigma: boolean;
  /** When false, only manual upload is shown for context (no Figma tab). Used in the Upload screenshot section. */
  figmaContextAllowed?: boolean;
}

const ContextImageUploader = ({
  onContextImagesChange,
  disabled = false,
  figmaConnected,
  checkingFigma,
  figmaContextAllowed = true,
}: ContextImageUploaderProps) => {
  const { t } = useLanguage();
  const { session } = useAuth();
  const [contextImages, setContextImages] = useState<ContextImage[]>([]);
  const [activeTab, setActiveTab] = useState<"upload" | "figma">("upload");
  /** Up to 3 Figma context links (single-screen Figma tab). Each non-empty URL becomes a pending context image. */
  const [figmaContextUrls, setFigmaContextUrls] = useState<[string, string, string]>(["", "", ""]);
  const [dragActive, setDragActive] = useState(false);

  const MAX_CONTEXT_IMAGES = 5;
  const MAX_FIGMA_CONTEXT_LINKS = 3;

  // Notify parent when context images change
  useEffect(() => {
    onContextImagesChange(contextImages);
  }, [contextImages, onContextImagesChange]);

  // Sync the 3 Figma context URL inputs to contextImages (pending figma items)
  useEffect(() => {
    if (!figmaContextAllowed) return;
    const urls = figmaContextUrls.filter((u) => u.trim());
    setContextImages((prev) => {
      const withoutPendingFigma = prev.filter(
        (img) => !(img.source === "figma" && img.figmaContextUrl && !img.signedUrl)
      );
      const remaining = MAX_CONTEXT_IMAGES - withoutPendingFigma.length;
      const urlsToAdd = urls.slice(0, Math.max(0, remaining));
      const newFigmaEntries: ContextImage[] = urlsToAdd.map((url, i) => ({
        id: `figma-context-${i}`,
        previewUrl: "",
        source: "figma" as const,
        figmaContextUrl: url.trim(),
      }));
      return [...withoutPendingFigma, ...newFigmaEntries];
    });
  }, [figmaContextAllowed, figmaContextUrls]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
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
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(
      (f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024
    );

    const remaining = MAX_CONTEXT_IMAGES - contextImages.length;
    if (remaining <= 0) {
      toast.error(t("maxContextImagesReached"));
      return;
    }

    const filesToAdd = validFiles.slice(0, remaining);

    const newImages: ContextImage[] = filesToAdd.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      source: "upload" as const,
    }));

    setContextImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setContextImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img?.previewUrl && img.source === "upload") {
        URL.revokeObjectURL(img.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const setFigmaContextUrlAt = (index: 0 | 1 | 2, value: string) => {
    setFigmaContextUrls((prev) => {
      const next: [string, string, string] = [...prev];
      next[index] = value;
      return next;
    });
  };

  const canAddMore = contextImages.length < MAX_CONTEXT_IMAGES;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div>
          <Label className="text-sm font-medium">
            {t("contextImagesLabel")}{" "}
            <span className="text-muted-foreground font-normal">({t("optional")})</span>
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            {t("contextImagesDescription")}
          </p>
        </div>
      </div>

      {/* Show context images and pending Figma links */}
      {contextImages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {contextImages.map((img, index) => (
            <div
              key={img.id}
              className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border bg-surface-1 flex flex-col items-center justify-center"
            >
              {img.figmaContextUrl && !img.signedUrl ? (
                <div className="flex flex-col items-center justify-center gap-0.5 p-1 w-full h-full text-center">
                  <Figma className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="text-[9px] text-muted-foreground truncate w-full px-0.5" title={img.figmaContextUrl}>
                    {img.figmaContextUrl.replace(/^https?:\/\//, "").slice(0, 18)}…
                  </span>
                </div>
              ) : (
                <img
                  src={img.previewUrl}
                  alt={`Context ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute top-0.5 left-0.5 px-1.5 py-0.5 bg-muted/80 text-[10px] font-medium rounded">
                C{index + 1}
              </div>
              {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: absolute-positioned remove badge (top-0.5 right-0.5 rounded-full bg-destructive) with group-hover:opacity-100; no aria-label; Button primitive positioning and shape conflict with the image overlay badge */}
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute top-0.5 right-0.5 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
              {img.source === "figma" && img.signedUrl && (
                <Figma className="absolute bottom-0.5 right-0.5 h-3 w-3 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add more context images */}
      {canAddMore && (
        figmaContextAllowed ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "figma")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="upload" className="text-xs gap-1.5 py-1">
                <Upload className="h-3 w-3" />
                {t("uploadTab")}
              </TabsTrigger>
              <TabsTrigger value="figma" className="text-xs gap-1.5 py-1">
                <Figma className="h-3 w-3" />
                {t("figmaTab")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-2">
              {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- clickableProps() spreads role + tabIndex + onKeyDown */}
              <div
                className={`border border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                  dragActive
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                // eslint-disable-next-line no-restricted-syntax -- REACT-004: hidden file-input + .click() is the canonical pattern for custom upload UX
                {...clickableProps(() => document.getElementById("context-file-upload")?.click())}
              >
                <input
                  id="context-file-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  aria-label={t("contextImagesLabel")}
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={disabled}
                />
                <ImageIcon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {t("addContextDragHint")}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t("maxContextImages")} ({MAX_CONTEXT_IMAGES - contextImages.length} {t("remaining")})
                </p>
              </div>
            </TabsContent>

            <TabsContent value="figma" className="mt-2 space-y-2">
              {checkingFigma ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("checkingFigmaConnection")}
                </div>
              ) : figmaConnected ? (
                <>
                  <div className="space-y-2">
                    {([0, 1, 2] as const).map((i) => (
                      <div key={i} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {t("figmaContextLinkNumber").replace("{{n}}", String(i + 1))}
                        </Label>
                        <div className="relative">
                          <Link className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            type="url"
                            value={figmaContextUrls[i]}
                            onChange={(e) => setFigmaContextUrlAt(i, e.target.value)}
                            placeholder="https://www.figma.com/file/..."
                            className="bg-surface-1 border-border pl-8 h-9 text-sm"
                            disabled={disabled}
                          />
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground">
                      {t("figmaContextHint")}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {t("connectFigmaFirst")}
                </p>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- clickableProps() spreads role + tabIndex + onKeyDown
          <div
            className={`border border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer mt-0 ${
              dragActive
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            // eslint-disable-next-line no-restricted-syntax -- REACT-004: hidden file-input + .click() is the canonical pattern for custom upload UX
            {...clickableProps(() => document.getElementById("context-file-upload-upload-only")?.click())}
          >
            <input
              id="context-file-upload-upload-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              aria-label={t("contextImagesLabel")}
              onChange={handleFileChange}
              className="hidden"
              disabled={disabled}
            />
            <ImageIcon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {t("addContextDragHint")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {t("maxContextImages")} ({MAX_CONTEXT_IMAGES - contextImages.length} {t("remaining")})
            </p>
          </div>
        )
      )}
    </div>
  );
};

export type { ContextImage };
export default ContextImageUploader;
