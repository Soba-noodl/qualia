import { Loader2, Paperclip } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useContextDocuments } from "@/hooks/use-context-documents";
import ContextDocumentItem from "./ContextDocumentItem";
import type { ContextDocumentRow } from "@/services/context-documents.service";

interface ContextDocumentListProps {
  projectId: string;
  /** If provided, shows delete buttons and calls this on delete */
  onDelete?: (doc: ContextDocumentRow) => void;
  deleteDisabled?: boolean;
  /** Max docs to show before "show more" (0 = no limit) */
  maxVisible?: number;
  /** Read-only hides delete UI */
  readOnly?: boolean;
  /** Show header with icon and count */
  showHeader?: boolean;
}

const ContextDocumentList = ({
  projectId,
  onDelete,
  deleteDisabled,
  maxVisible = 0,
  readOnly = true,
  showHeader = false,
}: ContextDocumentListProps) => {
  const { t } = useLanguage();
  const { data: contextDocs = [], isLoading } = useContextDocuments(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (contextDocs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/60 italic py-1">
        {t("additionalContextEmpty")}
      </p>
    );
  }

  const visibleDocs =
    maxVisible > 0 ? contextDocs.slice(0, maxVisible) : contextDocs;
  const hiddenCount = maxVisible > 0 ? Math.max(0, contextDocs.length - maxVisible) : 0;

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Paperclip className="h-4 w-4" />
          {t("additionalContextSection")} ({contextDocs.length})
        </div>
      )}

      <ul className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {visibleDocs.map((doc: ContextDocumentRow) => (
          <ContextDocumentItem
            key={doc.id}
            doc={doc}
            onDelete={onDelete}
            deleteDisabled={deleteDisabled}
            readOnly={readOnly}
          />
        ))}
      </ul>

      {hiddenCount > 0 && (
        <p className="text-[11px] text-muted-foreground pl-1">
          +{hiddenCount} {t("moreDocuments")}
        </p>
      )}
    </div>
  );
};

export default ContextDocumentList;
