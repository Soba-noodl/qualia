export type Rating = "outstanding" | "good" | "partial" | "poor";

type DimensionValue = string | { rating: Rating; verdict: string; action: string } | undefined;

export interface DesignSystemData {
  verdict: string;
  components?: DimensionValue;
  color?: DimensionValue;
  typography?: DimensionValue;
  spacing_layout?: DimensionValue;
  interactive_states?: DimensionValue;
  iconography?: DimensionValue;
  microcopy_voice?: DimensionValue;
  token_consistency?: DimensionValue;
  component_library?: DimensionValue;
}

function getRating(value: DimensionValue): Rating | null {
  if (!value || typeof value === "string") return null;
  const r = value.rating;
  if (r === "outstanding" || r === "good" || r === "partial" || r === "poor") return r;
  return null;
}

const KEYS: (keyof DesignSystemData)[] = [
  "components", "color", "typography", "spacing_layout",
  "interactive_states", "iconography", "microcopy_voice",
  "token_consistency", "component_library",
];

export function summaryRating(ds: DesignSystemData): Rating {
  const ratings = KEYS
    .map((k) => getRating(ds[k] as DimensionValue))
    .filter((r): r is Rating => r !== null);

  if (ratings.length === 0) return "partial";

  const poor = ratings.filter((r) => r === "poor").length;
  const partial = ratings.filter((r) => r === "partial").length;
  const outstanding = ratings.filter((r) => r === "outstanding").length;
  const total = ratings.length;

  if (poor / total >= 0.4) return "poor";
  if ((poor + partial) / total >= 0.5) return "partial";
  if (poor === 0 && outstanding / total >= 0.6) return "outstanding";
  return "good";
}

export function isPositiveVerdict(verdict: string): boolean {
  const lower = verdict.toLowerCase();
  return (
    /\bcoherent\b/.test(lower) ||
    /\bconsistent\b/.test(lower) ||
    /\bwell-enforced\b/.test(lower) ||
    /\bstrong\b/.test(lower)
  );
}
