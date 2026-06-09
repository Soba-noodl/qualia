import { TrendingUp, Wrench, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ExportPreset } from "@/lib/exportAuditPptx";

interface ExportPresetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (preset: ExportPreset) => Promise<void>;
  loading: boolean;
}

export function ExportPresetModal({ open, onOpenChange, onExport, loading }: ExportPresetModalProps) {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("exportReportTitle")}</DialogTitle>
          <DialogDescription>{t("exportReportSubtitle")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 pt-2">
          {/* Executive Brief */}
          {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: p-4 rounded-lg border bg-card tile with icon+title+desc nested block; Button primitive (h-10 rounded-md) would conflict with tile layout */}
          <button
            className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            onClick={() => onExport("executive")}
            disabled={loading}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t("exportPresetExecutiveTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("exportPresetExecutiveDesc")}</p>
            </div>
          </button>

          {/* Engineering Lead */}
          {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: p-4 rounded-lg border bg-card tile with icon+title+desc nested block; Button primitive (h-10 rounded-md) would conflict with tile layout */}
          <button
            className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            onClick={() => onExport("engineering_lead")}
            disabled={loading}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t("exportPresetEngineeringTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("exportPresetEngineeringDesc")}</p>
            </div>
          </button>
        </div>

        {loading && (
          <div role="status" aria-live="polite" aria-busy="true" className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("exportGenerating")}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
