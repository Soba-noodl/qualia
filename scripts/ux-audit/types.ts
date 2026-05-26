/**
 * Shared types for the q-ux-audit pipeline.
 * Spec: docs/superpowers/specs/2026-05-08-q-ux-audit-design.md
 */

export type Engine = 'SL' | 'H' | 'C' | 'I' | 'D' | 'X';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type Classification =
  | 'ux:component'
  | 'ux:export'
  | 'ux:strings'
  | 'ux:validation'
  | 'ux:metadata'
  | 'skip:plumbing'
  | 'skip:migration'
  | 'skip:types'
  | 'skip:test'
  | 'skip:config'
  | 'unknown';

export interface ClassifiedFile {
  filePath: string;
  classification: Classification;
  contentHash: string;
}

export interface FindingAnchor {
  filePath: string;
  line?: number;
}

export interface Finding {
  id: string;
  engine: Engine;
  severity: Severity;
  /** Number of routes/components affected. */
  reach: number;
  /** Computed: severityWeight × reachBand. */
  importance: number;
  anchors: FindingAnchor[];
  /** What the user experiences. */
  experience: string;
  /** Business consequence. */
  consequence: string;
  /** Recommended fix. */
  fix: string;
  /** Legitimate reason this could exist (steelman acknowledged before flagging). */
  steelman: string;
}

export interface EngineScore {
  engine: Engine;
  score: number;
}

export interface RouteAudit {
  route: string;
  entryFile: string;
  /** SL/H/C/I/D scores per route. Engine X is global, not per-route. */
  scores: EngineScore[];
  findings: Finding[];
}

export interface AuditResult {
  routeAudits: RouteAudit[];
  /** Single global Engine X score (0-100). 0 = skipped. */
  globalXScore: number;
  crossSectionalFindings: Finding[];
  deadState: Finding[];
  classifiedFiles: ClassifiedFile[];
  /** Surfaces (toasts, edge-fn strings, etc.) collected across files. */
  corpusFindings?: Finding[];
  /** Files we tried to follow from a route but couldn't fully resolve. */
  unresolved?: Array<{ filePath: string; reason: string }>;
  /** Whether Engine X was run (true only on full scope). */
  engineXRan: boolean;
  scopeDescription: string;
}

export type ScopeKind = 'since-main' | 'full' | 'feature' | 'path';

export interface Scope {
  kind: ScopeKind;
  /** Feature name, used when kind === 'feature'. */
  name?: string;
  /** Path filter, used when kind === 'path'. */
  pathFilter?: string;
  /** Original raw input for echo. */
  raw: string;
}

