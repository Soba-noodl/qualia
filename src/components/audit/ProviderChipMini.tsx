import type { LLMProvider } from "@/services/llm-key.service";

const PROVIDER_DOT: Record<LLMProvider, string> = {
  gemini: "bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500",
  anthropic: "bg-[#d4a27f]",
  openai: "bg-[#10a37f]",
};
const PROVIDER_NAME: Record<LLMProvider, string> = {
  gemini: "Gemini",
  anthropic: "Claude",
  openai: "GPT",
};

interface Props {
  provider: LLMProvider;
  /** `"trial"` styles the chip as a green "free trial · <provider>" pill.
   *  `"byok"` is the default neutral chip. */
  variant?: "byok" | "trial";
  /** When true, drops the brand text and just shows the dot — for compact contexts. */
  dotOnly?: boolean;
  className?: string;
}

export function ProviderChipMini({ provider, variant = "byok", dotOnly = false, className }: Props) {
  const isTrial = variant === "trial";
  const baseClasses = "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium border backdrop-blur-sm";
  const variantClasses = isTrial
    ? "bg-green-500/10 border-green-500/30 text-green-400"
    : "bg-background/85 border-border text-foreground";
  return (
    <span className={`${baseClasses} ${variantClasses} ${className ?? ""}`} title={`${PROVIDER_NAME[provider]}${isTrial ? " · free trial" : ""}`}>
      <span className={`w-2 h-2 rounded-full ${PROVIDER_DOT[provider]} flex-shrink-0`} />
      {!dotOnly && (
        <span>
          {isTrial && "Free · "}
          {PROVIDER_NAME[provider]}
        </span>
      )}
    </span>
  );
}
