import React, { useEffect } from "react";
import type { Store } from "../store";
import { PluginShell } from "../components/PluginShell";
import { Card } from "../components/Card";
import { AuditCard } from "../components/AuditCard";
import { usePluginLanguage } from "../usePluginLanguage";
import { capture } from "../posthog";
import { QUALIA_PROJECTS_URL } from "../api";
import type { AuditListItem } from "../api";

const GEAR_PATH =
  "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z";

type Props = {
  store: Store;
  setStore: (patch: Partial<Store>) => void;
  onOpenAudit: (id: string) => void;
  onRefresh: () => void;
};

export function HomeFeedView({ store, setStore, onOpenAudit, onRefresh }: Props) {
  const { t } = usePluginLanguage();

  useEffect(() => {
    capture("plugin_home_view_opened", { audits_count: store.audits.length });
    // Fire once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAuditClick = (audit: AuditListItem, position: number) => {
    capture("plugin_home_audit_clicked", {
      audit_id: audit.id,
      source: audit.source,
      position,
    });
    onOpenAudit(audit.id);
  };

  const handleNewAuditClick = () => {
    capture("plugin_home_new_audit_clicked");
    setStore({ view: "new-audit" });
  };

  const handleViewAllClick = () => {
    capture("plugin_home_view_all_clicked");
    (window as unknown as { open: (u: string, t: string) => void }).open(QUALIA_PROJECTS_URL, "_blank");
  };

  const headerActions = (
    <>
      <button
        type="button"
        aria-label={t("homeFeedRefreshAria")}
        onClick={onRefresh}
        className="w-7 h-7 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-foreground/65 hover:text-foreground transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={t("homeFeedSettingsAria")}
        onClick={() => setStore({ view: "settings", previousView: "home" })}
        className="w-7 h-7 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-foreground/65 hover:text-foreground transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={GEAR_PATH} />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </>
  );

  return (
    <PluginShell rightAction={<div className="flex items-center gap-1.5">{headerActions}</div>}>
      <div className="flex flex-col flex-1 p-3.5 gap-3.5">
        <Card onClick={handleNewAuditClick} className="flex items-center gap-3 bg-primary/10 border-primary/40">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-foreground mb-0.5">{t("homeFeedMakeNewAudit")}</p>
            <p className="text-[13px] text-foreground/65 m-0">{t("homeFeedMakeNewAuditSubtitle")}</p>
          </div>
          <span aria-hidden className="text-foreground/60">→</span>
        </Card>

        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-foreground/65">{t("homeFeedPreviousAudits")}</p>

          {store.auditsError && (
            <div className="rounded-xl border border-border bg-surface-1 p-3 flex items-center justify-between">
              <p className="text-[12px] text-foreground/70 m-0">{store.auditsError}</p>
              <button
                type="button"
                onClick={onRefresh}
                className="text-[12px] text-primary hover:underline"
              >
                {t("homeFeedRetry")}
              </button>
            </div>
          )}

          {store.auditsLoading && store.audits.length === 0 && !store.auditsError && (
            <>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  data-testid="audit-card-skeleton"
                  className="rounded-xl border border-border bg-surface-1 p-3.5 h-[58px] animate-pulse"
                />
              ))}
            </>
          )}

          {!store.auditsLoading && !store.auditsError && store.audits.length === 0 && (
            <p className="text-[12px] text-foreground/55 m-0">{t("homeFeedNoAuditsYet")}</p>
          )}

          {store.audits.map((audit, i) => (
            <AuditCard key={audit.id} audit={audit} onClick={() => handleAuditClick(audit, i)} />
          ))}
        </div>

        <button
          type="button"
          onClick={handleViewAllClick}
          className="self-start text-[12px] text-primary hover:underline"
        >
          {t("homeFeedViewAllInQualia")}
        </button>
      </div>
    </PluginShell>
  );
}
