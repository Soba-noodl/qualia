export type Round = "MVP-1" | "qual_1" | "qual_2" | "qual_3" | "qual_4";
export type SourceType = "direct-quote" | "paraphrased" | "inferred";

export interface EvidenceSource {
  date: string;
  round: Round;
  sourceType: SourceType;
}

export interface EvidenceInput {
  sources: EvidenceSource[];
  contradictedBy: number;
  asOf: string;
}

export interface WeightAxes {
  recency: number;
  frequency: number;
  productMaturity: number;
  sourceType: number;
  convergence: number;
}

export type WeightBucket = "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";

export interface WeightResult {
  axes: WeightAxes;
  total: number;
  bucket: WeightBucket;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);
}

function scoreRecency(sources: EvidenceSource[], asOf: string): number {
  if (sources.length === 0) return 0;
  const newest = Math.min(...sources.map((s) => daysBetween(s.date, asOf)));
  if (newest <= 60) return 3;
  if (newest <= 180) return 2;
  if (newest <= 365) return 1;
  return 0;
}

function scoreFrequency(n: number): number {
  if (n >= 5) return 3;
  if (n >= 3) return 2.5;
  if (n === 2) return 2;
  if (n === 1) return 1;
  return 0;
}

const ROUND_MATURITY: Record<Round, number> = {
  "qual_4": 3,
  "qual_3": 3,
  "qual_2": 2,
  "qual_1": 2,
  "MVP-1": 1,
};

function scoreProductMaturity(sources: EvidenceSource[]): number {
  if (sources.length === 0) return 0;
  return Math.max(...sources.map((s) => ROUND_MATURITY[s.round] ?? 0));
}

const SOURCE_TYPE_SCORE: Record<SourceType, number> = {
  "direct-quote": 3,
  "paraphrased": 2,
  "inferred": 1,
};

function scoreSourceType(sources: EvidenceSource[]): number {
  if (sources.length === 0) return 0;
  return Math.max(...sources.map((s) => SOURCE_TYPE_SCORE[s.sourceType] ?? 0));
}

function scoreConvergence(sources: EvidenceSource[], contradictedBy: number): number {
  if (sources.length === 0) return 0;
  if (contradictedBy >= sources.length) return 0;
  if (contradictedBy > 0) return 1;
  if (sources.length >= 3) return 3;
  if (sources.length === 2) return 2;
  return 1;
}

function bucketize(total: number): WeightBucket {
  if (total >= 14) return "HIGH";
  if (total >= 9) return "MEDIUM";
  if (total >= 6) return "LOW";
  return "VERY_LOW";
}

export function computeWeight(input: EvidenceInput): WeightResult {
  const axes: WeightAxes = {
    recency: scoreRecency(input.sources, input.asOf),
    frequency: scoreFrequency(input.sources.length),
    productMaturity: scoreProductMaturity(input.sources),
    sourceType: scoreSourceType(input.sources),
    convergence: scoreConvergence(input.sources, input.contradictedBy),
  };
  const total = axes.recency + axes.frequency + axes.productMaturity + axes.sourceType + axes.convergence;
  // G1: single-source claims are capped at LOW — one log entry is never enough
  // to promote a finding to MEDIUM or higher regardless of recency/quality.
  let bucket = bucketize(total);
  if (input.sources.length === 1 && (bucket === "HIGH" || bucket === "MEDIUM")) {
    bucket = "LOW";
  }
  return { axes, total, bucket };
}
