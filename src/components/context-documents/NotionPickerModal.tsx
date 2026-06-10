import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { fetchNotionPages } from "@/services/integration.service";
import { useLanguage } from "@/contexts/LanguageContext";

export type NotionPageItem = { id: string; title: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (pages: NotionPageItem[]) => void;
  maxSelect?: number;
};

export function NotionPickerModal({
  open,
  onOpenChange,
  onSelect,
  maxSelect = 5,
}: Props) {
  const { t } = useLanguage();
  const [pages, setPages] = useState<NotionPageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setPages([]);
    setError(null);
    setSelectedIds(new Set());
    setSearch("");
    setLoading(true);
    fetchNotionPages()
      .then(setPages)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = search.trim()
    ? pages.filter(
        (p) =>
          p.title.toLowerCase().includes(search.trim().toLowerCase())
      )
    : pages;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < maxSelect) next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = pages.filter((p) => selectedIds.has(p.id));
    onSelect(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("notionPickerTitle")}</DialogTitle>
          <DialogDescription>{t("notionPickerDescription")}</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {!loading && !error && pages.length > 0 && (
          <>
            <Input
              placeholder={t("notionPickerSearchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-surface-1 border-border"
            />
            <div className="min-h-[200px] max-h-[320px] overflow-y-auto rounded-md border border-border bg-muted/20 p-2 space-y-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("notionPickerNoResults")}
                </p>
              ) : (
                filtered.map((page) => (
                  <label
                    key={page.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.has(page.id)}
                      onCheckedChange={() => toggle(page.id)}
                      disabled={
                        !selectedIds.has(page.id) && selectedIds.size >= maxSelect
                      }
                    />
                    <span className="text-sm truncate flex-1">{page.title || "Untitled"}</span>
                  </label>
                ))
              )}
            </div>
          </>
        )}

        {!loading && !error && pages.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t("notionPickerEmpty")}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("notionPickerCancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
          >
            {t("notionPickerConfirm")} {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
