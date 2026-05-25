import { FileText, Upload, HardDrive, BookOpen, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ContextDocumentRow } from "@/services/context-documents.service";

interface ContextDocumentItemProps {
  doc: ContextDocumentRow;
  /** If provided, shows a delete button */
  onDelete?: (doc: ContextDocumentRow) => void;
  deleteDisabled?: boolean;
  /** Read-only mode hides delete and shows more compact layout */
  readOnly?: boolean;
}

const SOURCE_ICONS: Record<string, typeof Upload> = {
  upload: Upload,
  drive: HardDrive,
  notion: BookOpen,
};

const SOURCE_LABELS: Record<string, string> = {
  upload: "Upload",
  drive: "Google Drive",
  notion: "Notion",
};

/** Truncate a filename to maxLen chars with ellipsis */
function truncateName(name: string, maxLen = 40): string {
  if (name.length <= maxLen) return name;
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const base = name.slice(0, maxLen - ext.length - 1);
  return `${base}…${ext}`;
}

const ContextDocumentItem = ({
  doc,
  onDelete,
  deleteDisabled,
  readOnly = false,
}: ContextDocumentItemProps) => {
  const { t } = useLanguage();
  const fullName = doc.original_filename || "Document";
  const displayName = truncateName(fullName);
  const SourceIcon = SOURCE_ICONS[doc.source] ?? Upload;
  // If created less than 2 minutes ago and no summary yet, show "generating" state
  const isRecent = Date.now() - new Date(doc.created_at).getTime() < 2 * 60 * 1000;
  const isGenerating = !doc.summary && isRecent;
  const summaryText = doc.summary
    ? doc.summary
    : isGenerating
    ? t("generatingSummary")
    : t("summaryUnavailable");
  const hasSummary = !!doc.summary;

  return (
    <li className="flex flex-col gap-1.5 bg-surface-1/80 border border-border/60 rounded-lg px-3 py-2.5 hover:border-border transition-colors">
      {/* Top row: icon + name + source badge + delete */}
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate flex-1 text-xs font-medium text-foreground">
                {displayName}
              </span>
            </TooltipTrigger>
            {fullName.length > 40 && (
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs break-all">{fullName}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0"
        >
          {SOURCE_LABELS[doc.source] ?? doc.source}
        </Badge>

        {!readOnly && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(doc)}
            disabled={deleteDisabled}
            className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0 ml-auto"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Summary row */}
      <p
        className={`text-[11px] leading-relaxed pl-5.5 flex items-center gap-1.5 ${
          hasSummary ? "text-muted-foreground" : "text-muted-foreground/60 italic"
        }`}
        style={{ paddingLeft: "22px" }}
      >
        {isGenerating && <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />}
        {summaryText}
      </p>
    </li>
  );
};

export default ContextDocumentItem;
