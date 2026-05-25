import React from "react";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { usePluginLanguage } from "../usePluginLanguage";
import type { AuditListItem } from "../api";

const TYPE_LABEL_KEY: Record<AuditListItem["type"], string> = {
  single: "homeFeedTypeSingle",
  flow: "homeFeedTypeFlow",
  prototype: "homeFeedTypePrototype",
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function relativeDate(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diffMs = Math.max(0, now - t);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  // eslint-disable-next-line no-restricted-syntax -- DATE-001: figma-plugin is a separate build and can't import src/lib/dateFormat
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Props = { audit: AuditListItem; onClick: () => void };

export function AuditCard({ audit, onClick }: Props) {
  const { t } = usePluginLanguage();
  const isWeb = audit.source !== "plugin";
  const meta = [audit.project?.name, t(TYPE_LABEL_KEY[audit.type]), relativeDate(audit.created_at)]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card onClick={onClick} className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <p
          title={audit.name}
          className="flex-1 min-w-0 truncate text-[14px] font-semibold text-foreground"
        >
          {audit.name}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {isWeb && <Badge variant="engine">{t("homeFeedWebBadge")}</Badge>}
          {audit.score != null && (
            <span className={`text-[14px] font-bold ${scoreColor(audit.score)}`}>
              {audit.score}
            </span>
          )}
        </div>
      </div>
      <p className="text-[12px] text-foreground/60 truncate" title={meta}>
        {meta}
      </p>
    </Card>
  );
}
