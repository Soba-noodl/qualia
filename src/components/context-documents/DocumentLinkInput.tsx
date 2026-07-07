import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { useIntegrationStatus, useInitiateOAuth } from "@/hooks/use-integrations";
import { useDrivePicker } from "@/hooks/use-drive-picker";
import { NotionPickerModal } from "@/components/context-documents/NotionPickerModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/components/ui/sonner";

type Provider = "drive" | "notion";

export type LinkEntry = {
  id: string;
  url: string;
  provider: Provider | null;
  /** Optional display name (e.g. from Drive/Notion picker); shown instead of url when set. */
  displayName?: string;
};

type Props = {
  maxLinks?: number;
  /** Called when internal "Fetch content" button is clicked (uncontrolled usage). */
  onFetchClicked?: (links: LinkEntry[]) => void;
  /** Called every time links change (for controlled / parent-tracked usage). */
  onLinksChange?: (links: LinkEntry[]) => void;
  /** Called when unfetched-links state changes so parent can disable Save etc. */
  onHasUnfetchedLinksChange?: (has: boolean) => void;
  /** Show the built-in "Fetch content" button. Default true. */
  showFetchButton?: boolean;
  /** Show provider connection status. Default true. */
  showConnectionStatus?: boolean;
  /** Whether the component is in a loading / disabled state. */
  disabled?: boolean;
  /** Loading label to show on fetch button when parent is processing. */
  loadingLabel?: string;
  /** If set, stored before OAuth redirect so the app can reopen this context after callback (e.g. "new-project-import"). */
  returnTo?: string;
};

/** Build a Notion URL whose last path segment ends with 32 hex chars so parseNotionUrl can extract the page ID. */
function notionPageUrl(pageId: string): string {
  const hexId = pageId.replace(/-/g, "");
  return `https://www.notion.so/${hexId}`;
}

export function DocumentLinkInput({
  maxLinks = 5,
  onFetchClicked,
  onLinksChange,
  onHasUnfetchedLinksChange,
  showFetchButton = true,
  showConnectionStatus = true,
  disabled = false,
  loadingLabel,
  returnTo,
}: Props) {
  const { t } = useLanguage();
  const [links, setLinks] = useState<LinkEntry[]>([]);
  const { data: status } = useIntegrationStatus();
  const initiateOAuth = useInitiateOAuth();
  const { openDrivePicker, pickerError } = useDrivePicker();
  const [drivePickerLoading, setDrivePickerLoading] = useState(false);
  const [notionPickerOpen, setNotionPickerOpen] = useState(false);

  const isDriveConnected = status?.drive ?? false;
  const isNotionConnected = status?.notion ?? false;
  const hasAnyConnection = isDriveConnected || isNotionConnected;

  const connectProvider = (provider: Provider) => {
    initiateOAuth.mutate(returnTo ? { provider, returnTo } : provider);
  };

  const updateLinks = (updater: LinkEntry[] | ((prev: LinkEntry[]) => LinkEntry[])) => {
    setLinks((prev) => {
      const newLinks = typeof updater === "function" ? updater(prev) : updater;
      onLinksChange?.(newLinks);
      onHasUnfetchedLinksChange?.(newLinks.length > 0);
      return newLinks;
    });
  };

  const removeLink = (id: string) => {
    updateLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const handleChooseFromDrive = async () => {
    if (links.length >= maxLinks || disabled) return;
    setDrivePickerLoading(true);
    try {
      const docs = await openDrivePicker();
      if (docs.length === 0) return;
      const remaining = maxLinks - links.length;
      const toAdd = docs.slice(0, remaining).map((doc) => ({
        id: crypto.randomUUID(),
        url: `https://drive.google.com/file/d/${doc.id}/view`,
        provider: "drive" as const,
        displayName: doc.name,
      }));
      updateLinks((prev) => [...prev, ...toAdd]);
    } catch (err) {
      if (err instanceof Error && err.message === "CANCELLED") return;
      toast.error(err instanceof Error ? err.message : t("pickerErrorGeneric"));
    } finally {
      setDrivePickerLoading(false);
    }
  };

  const handleChooseFromNotion = (pages: { id: string; title: string }[]) => {
    if (pages.length === 0) return;
    const remaining = maxLinks - links.length;
    const toAdd = pages.slice(0, remaining).map((page) => ({
      id: crypto.randomUUID(),
      url: notionPageUrl(page.id),
      provider: "notion" as const,
      displayName: page.title,
    }));
    updateLinks((prev) => [...prev, ...toAdd]);
  };

  const handleFetch = () => {
    if (!onFetchClicked) return;
    onFetchClicked(links);
    updateLinks([]);
  };

  const hasUnfetchedLinks = links.length > 0;
  const needsDriveConnection = links.some((l) => l.provider === "drive") && !isDriveConnected;
  const needsNotionConnection = links.some((l) => l.provider === "notion") && !isNotionConnected;

  return (
    <div className="space-y-3">
      {/* Two-button layout: Connect (when not connected) or Choose (when connected) */}
      <div className="flex flex-wrap gap-2 justify-center">
        {!hasAnyConnection ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => connectProvider("drive")}
              disabled={disabled || initiateOAuth.isPending}
            >
              {initiateOAuth.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              {t("integrationConnectDrive")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => connectProvider("notion")}
              disabled={disabled || initiateOAuth.isPending}
            >
              {initiateOAuth.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              {t("integrationConnectNotion")}
            </Button>
          </>
        ) : (
          <>
            {isDriveConnected ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleChooseFromDrive}
                disabled={links.length >= maxLinks || disabled || drivePickerLoading}
              >
                {drivePickerLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    {t("pickerLoading")}
                  </>
                ) : (
                  t("chooseFromDrive")
                )}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => connectProvider("drive")}
                disabled={disabled || initiateOAuth.isPending}
              >
                {initiateOAuth.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                {t("integrationConnectDrive")}
              </Button>
            )}
            {isNotionConnected ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setNotionPickerOpen(true)}
                disabled={links.length >= maxLinks || disabled}
              >
                {t("chooseFromNotion")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => connectProvider("notion")}
                disabled={disabled || initiateOAuth.isPending}
              >
                {initiateOAuth.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                {t("integrationConnectNotion")}
              </Button>
            )}
          </>
        )}
      </div>

      <NotionPickerModal
        open={notionPickerOpen}
        onOpenChange={setNotionPickerOpen}
        onSelect={handleChooseFromNotion}
        maxSelect={maxLinks - links.length}
      />

      {pickerError && (
        <p className="text-xs text-amber-500">{pickerError.message}</p>
      )}

      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface-1/80 px-3 py-2 text-xs"
            >
              <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                <span className="truncate text-foreground">{link.displayName ?? link.url}</span>
                <span className="text-[10px] text-muted-foreground">
                  {link.provider === "drive"
                    ? t("integrationDrive")
                    : link.provider === "notion"
                    ? t("integrationNotion")
                    : t("integrationUnknownProvider")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeLink(link.id)}
                disabled={disabled}
                className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0 ml-2"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {(needsDriveConnection || needsNotionConnection) && (
        <div className="flex flex-wrap gap-2">
          {needsDriveConnection && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => connectProvider("drive")}
              disabled={initiateOAuth.isPending}
            >
              {initiateOAuth.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              {t("integrationConnectDrive")}
            </Button>
          )}
          {needsNotionConnection && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => connectProvider("notion")}
              disabled={initiateOAuth.isPending}
            >
              {initiateOAuth.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              {t("integrationConnectNotion")}
            </Button>
          )}
        </div>
      )}

      <div className={`flex items-center gap-2 ${showFetchButton ? "justify-between" : "justify-center"}`}>
        {showFetchButton && (
          <Button
            type="button"
            onClick={handleFetch}
            disabled={links.length === 0 || disabled}
            size="sm"
            variant={hasUnfetchedLinks ? "default" : "outline"}
          >
            {disabled && loadingLabel ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                {loadingLabel}
              </>
            ) : (
              t("linkInputFetchContent")
            )}
          </Button>
        )}
        {showConnectionStatus && hasAnyConnection && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {isDriveConnected && isNotionConnected
                ? `Drive & Notion: ${t("integrationConnected")}`
                : isDriveConnected
                ? `Drive: ${t("integrationConnected")}`
                : `Notion: ${t("integrationConnected")}`}
            </span>
          </div>
        )}
      </div>
      {showConnectionStatus && hasAnyConnection && (
        <div className="space-y-0.5 text-[10px] text-muted-foreground/70 text-center">
          <p>{t("integrationPermissionSettingsHint")}</p>
          <p>{t("linkInputLimitHint")}</p>
        </div>
      )}
    </div>
  );
}
