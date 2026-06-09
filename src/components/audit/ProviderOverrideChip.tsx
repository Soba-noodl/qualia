import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLlmKeys } from "@/hooks/use-llm-keys";
import type { LLMProvider } from "@/services/llm-key.service";

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  gemini: "Gemini",
  openai: "GPT",
};

const PROVIDER_DOT: Record<LLMProvider, string> = {
  gemini: "bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500",
  openai: "bg-[#10a37f]",
};

interface Props {
  value: LLMProvider;
  onChange: (provider: LLMProvider) => void;
}

export function ProviderOverrideChip({ value, onChange }: Props) {
  const { data: keys = [] } = useLlmKeys();
  const [open, setOpen] = useState(false);

  // If user has no keys at all, hide the chip (the form-level guards handle this case).
  if (keys.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/*
          Pill button sized to sit beside the primary Audit button.
          - h-10 matches Button default height in this codebase.
          - bg-surface-2 + border = visually present (not text-only), reads as a control.
          - Hover: border-primary/40 to signal interactivity.
          - Dot uses provider's brand color; label is foreground; chevron is muted.
        */}
        <button
          type="button"
          aria-label={`Provider: ${PROVIDER_LABELS[value]}. Click to change`}
          className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-border bg-surface-2/60 hover:bg-surface-2 hover:border-primary/40 transition-colors text-xs"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${PROVIDER_DOT[value]}`} />
          <span className="text-foreground font-medium">{PROVIDER_LABELS[value]}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end">
        {(["gemini", "openai"] as const).map((p) => {
          const hasKey = keys.some((k) => k.provider === p);
          return (
            <button
              key={p}
              type="button"
              disabled={!hasKey}
              onClick={() => { onChange(p); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${PROVIDER_DOT[p]}`} />
              <span>{PROVIDER_LABELS[p]}</span>
              {p === "gemini" && (
                <span className="text-[9px] font-medium uppercase tracking-wide text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded ml-1">preferred</span>
              )}
              {!hasKey && <span className="text-[10px] text-muted-foreground ml-auto">not configured</span>}
              {p === value && hasKey && <span className="text-xs text-primary ml-auto">✓</span>}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
