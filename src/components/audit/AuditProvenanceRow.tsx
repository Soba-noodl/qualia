import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProviderChipMini } from "./ProviderChipMini";
import type { LLMProvider } from "@/services/llm-key.service";

interface Props {
  auditId: string;
}

interface UsageRow {
  provider: LLMProvider;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_estimate_usd: number;
  cost_known: boolean;
  prompt_version: string | null;
  paid_by: "platform" | "user";
}

export function AuditProvenanceRow({ auditId }: Props) {
  const { t } = useLanguage();
  const { data } = useQuery({
    queryKey: ["audit-provenance", auditId],
    queryFn: async (): Promise<UsageRow | null> => {
      // eslint-disable-next-line no-restricted-syntax -- ARCH-004: read-only diagnostic query, no service wrapper warranted
      const { data: row, error } = await supabase
        .from("ai_usage_events")
        .select("provider, model, prompt_tokens, completion_tokens, cost_estimate_usd, cost_known, prompt_version, paid_by")
        .eq("audit_id", auditId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("[AuditProvenanceRow] query failed:", error.message);
        return null;
      }
      return row as UsageRow | null;
    },
    staleTime: 5 * 60_000,
  });

  if (!data) return null;

  const totalTokens = data.prompt_tokens + data.completion_tokens;
  const usdLabel = data.cost_known
    ? `$${Number(data.cost_estimate_usd).toFixed(3)}`
    : "—";

  return (
    <div className="flex items-center gap-x-5 gap-y-2 flex-wrap rounded-lg border border-border bg-surface-1/70 backdrop-blur-sm px-4 py-3 text-xs">
      <ProvCell label={t("provenanceProvider")}>
        <ProviderChipMini
          provider={data.provider}
          variant={data.paid_by === "platform" ? "trial" : "byok"}
        />
      </ProvCell>
      <Divider />
      <ProvCell label={t("provenanceModel")}>
        <span className="font-mono text-foreground">{data.model}</span>
      </ProvCell>
      <Divider />
      <ProvCell label={t("provenanceTokens")}>
        <span className="font-mono text-foreground">{data.prompt_tokens.toLocaleString()} in · {data.completion_tokens.toLocaleString()} out</span>
        <span className="text-muted-foreground"> ({totalTokens.toLocaleString()})</span>
      </ProvCell>
      <Divider />
      <ProvCell label={t("provenanceCost")}>
        <span className="font-mono text-foreground" title={data.paid_by === "platform" ? t("provenanceFreeTrial") : t("provenanceBilledToYou")}>
          {usdLabel}
        </span>
      </ProvCell>
      {data.prompt_version && (
        <>
          <Divider />
          <ProvCell label={t("provenancePromptVersion")}>
            <span className="text-muted-foreground">{data.prompt_version}</span>
          </ProvCell>
        </>
      )}
    </div>
  );
}

function ProvCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <span className="flex items-center gap-1">{children}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-7 bg-border" aria-hidden />;
}
