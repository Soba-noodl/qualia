import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MODEL_OPTIONS_BY_PROVIDER } from "@/lib/llm-defaults";
import type { LLMProvider } from "@/services/llm-key.service";

interface Props {
  provider: LLMProvider;
  value: string;
  /** The user's saved model_override for this provider, if any. Used to
   *  surface a "Custom: <id>" option when it's outside the curated list. */
  savedOverride?: string | null;
  onChange: (model: string) => void;
}

export function ModelOverrideChip({ provider, value, savedOverride, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const curated = MODEL_OPTIONS_BY_PROVIDER[provider];

  const savedIsCustom =
    !!savedOverride && !curated.some((o) => o.value === savedOverride);

  const allOptions = [
    ...curated,
    ...(savedIsCustom ? [{ value: savedOverride!, label: `Custom: ${savedOverride}` }] : []),
  ];

  const labelFor = (modelId: string) => {
    const opt = allOptions.find((o) => o.value === modelId);
    return opt?.label ?? modelId; // raw ID fallback for unknowns
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Model: ${labelFor(value)}. Click to change`}
          className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-border bg-surface-2/60 hover:bg-surface-2 hover:border-primary/40 transition-colors text-xs max-w-[140px]"
        >
          <span className="text-foreground font-medium truncate">{labelFor(value)}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="end">
        {allOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-xs text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="truncate">{opt.label}</div>
              {opt.note && <div className="text-[10px] text-muted-foreground">{opt.note}</div>}
            </div>
            {opt.value === value && <span className="text-xs text-primary flex-shrink-0">✓</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
