import { Figma, Loader2, Upload } from "lucide-react";
import { clickableProps } from "@/lib/a11y";

interface ProjectUploadZoneProps {
  uploading: boolean;
  onClick: () => void;
  uploadLabel: string;
  uploadingLabel: string;
  idleHint: string;
  uploadingHint: string;
  dataTour?: string;
  onDropFiles?: (files: FileList | File[]) => void;
}

export function ProjectUploadZone({
  uploading,
  onClick,
  uploadLabel,
  uploadingLabel,
  idleHint,
  uploadingHint,
  dataTour,
  onDropFiles,
}: ProjectUploadZoneProps) {
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onDropFiles || uploading) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onDropFiles || uploading) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      onDropFiles(event.dataTransfer.files);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- clickableProps() spreads role + tabIndex + onKeyDown
    <div
      {...clickableProps(onClick)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-tour={dataTour}
      className={`glass rounded-xl p-4 sm:p-8 text-center transition-all cursor-pointer hover:glow-border ${
        uploading ? "pointer-events-none" : ""
      }`}
    >
      {uploading ? (
        <div role="status" aria-live="polite" aria-busy="true">
          <Loader2 className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-4 text-primary animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading…</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-4">
          <Upload className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
          <Figma className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-base sm:text-lg font-semibold mb-1">
        {uploading ? uploadingLabel : uploadLabel}
      </h3>
      <p className="text-xs sm:text-sm text-muted-foreground">
        {uploading ? uploadingHint : idleHint}
      </p>
    </div>
  );
}
