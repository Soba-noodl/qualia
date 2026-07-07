import {
  AlertTriangle,
  BarChart3,
  Eye,
  FileSearch,
  FolderOpen,
  RefreshCw,
  ThumbsUp,
  Users,
} from "lucide-react";

const mockupCardClass =
  "rounded-xl border border-border bg-card p-5 h-[280px] flex flex-col overflow-hidden";

/** Designers — report view only (no screenshot): score + four engines. Differs from Use Cases single-screen mockup. */
export const DesignersMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 block">
      Report
    </span>

    {/* Score bar (same pattern as Use Cases SingleScreenMockup bottom) */}
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs text-muted-foreground">UX Score</span>
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <div className="h-full w-[72%] bg-amber-500 rounded-full" />
        </div>
        <span className="text-sm font-semibold text-amber-500">72</span>
      </div>
    </div>

    {/* Four engines (real report structure, no screenshot) */}
    <div className="flex-grow min-h-0 rounded-lg bg-surface-2 border border-border/50 p-3 space-y-2 overflow-hidden">
      {[
        { name: "System logic", count: 2, dot: "bg-destructive" },
        { name: "Heuristic", count: 1, dot: "bg-amber-500" },
        { name: "Cognitive", count: 1, dot: "bg-amber-500" },
        { name: "Interaction", count: 0, dot: "bg-green-500" },
      ].map((row) => (
        <div key={row.name} className="flex items-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${row.dot}`} />
          <span className="text-muted-foreground flex-1">{row.name}</span>
          <span className="text-muted-foreground/70">{row.count} issue{row.count !== 1 ? "s" : ""}</span>
        </div>
      ))}
    </div>
  </div>
);

/** PMs — One Big Thing + issues by engine (matches real report). Style aligned with UseCaseMockups. */
export const PMsMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 block">
      Prioritised issues
    </span>

    {/* One Big Thing */}
    <div className="rounded-lg bg-destructive/5 border border-destructive/40 p-3 mb-3">
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
        <span className="text-xs font-semibold text-red-400">One Big Thing</span>
      </div>
      <div className="h-2 w-full bg-surface-3/50 rounded mb-1" />
      <div className="h-2 w-2/3 bg-surface-3/50 rounded" />
    </div>

    {/* Issue list by engine */}
    <div className="rounded-lg bg-surface-2 border border-border/50 p-3 space-y-2 flex-grow min-h-0 overflow-hidden">
      {[
        { severity: "bg-destructive", label: "System logic: flow dead end at step 3" },
        { severity: "bg-amber-500", label: "Heuristic: unclear CTA hierarchy" },
        { severity: "bg-amber-500", label: "Cognitive: missing error state" },
      ].map((issue, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${issue.severity}`} />
          <span className="text-muted-foreground truncate flex-1 min-w-0">{issue.label}</span>
        </div>
      ))}
    </div>

    <div className="flex items-center gap-1.5 mt-3 text-[10px] text-muted-foreground">
      <Eye className="h-3 w-3 text-primary flex-shrink-0" />
      <span>
        Analysed with <span className="text-foreground/70 font-medium">3 personas</span> &amp; product context
      </span>
    </div>
  </div>
);

/** Finance — Analytics metrics (matches real Analytics). Style aligned with UseCaseMockups. */
export const FinanceMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-2">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 block">
      Analytics
    </span>

    {/* KPI cards — compact so everything fits inside card */}
    <div className="grid grid-cols-2 gap-1.5 mb-2 flex-shrink-0">
      <div className="rounded-lg bg-surface-2 border border-border/50 p-2 flex items-center gap-1.5 min-h-0">
        <FolderOpen className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <span className="text-base font-bold block leading-tight">4</span>
          <p className="text-[9px] text-muted-foreground">Projects</p>
        </div>
      </div>
      <div className="rounded-lg bg-surface-2 border border-border/50 p-2 flex items-center gap-1.5 min-h-0">
        <FileSearch className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <span className="text-base font-bold block leading-tight">24</span>
          <p className="text-[9px] text-muted-foreground">Audits</p>
        </div>
      </div>
      <div className="rounded-lg bg-surface-2 border border-border/50 p-2 flex items-center gap-1.5 min-h-0">
        <ThumbsUp className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <span className="text-base font-bold block leading-tight">18</span>
          <p className="text-[9px] text-muted-foreground">Useful</p>
        </div>
      </div>
      <div className="rounded-lg bg-surface-2 border border-border/50 p-2 flex items-center gap-1.5 min-h-0">
        <RefreshCw className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <span className="text-base font-bold block leading-tight">6</span>
          <p className="text-[9px] text-muted-foreground">Iterations</p>
        </div>
      </div>
    </div>

    {/* Audits over time — flex-grow with min-h-0 so it shrinks inside card */}
    <div className="flex-grow min-h-0 rounded-lg bg-surface-2 border border-border/50 p-2 flex flex-col justify-end">
      <div className="flex items-end gap-0.5 h-8 flex-shrink-0">
        {[2, 4, 1, 5, 3, 6, 3].map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-primary/60 min-w-0"
            style={{ height: `${Math.max(16, v * 8)}px` }}
          />
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground mt-1 text-center">Audits over time</p>
    </div>
  </div>
);

/** Management — score by project (matches real Analytics). Style aligned with UseCaseMockups. */
export const ManagementMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 block">
      Score by project
    </span>

    {/* Project rows — min-h-0 so flex-grow shrinks inside card */}
    <div className="flex-grow min-h-0 rounded-lg bg-surface-2 border border-border/50 p-2.5 space-y-1.5 overflow-hidden">
      {[
        { name: "Onboarding", audits: 8, score: 81, scoreColor: "text-green-500" },
        { name: "Checkout", audits: 5, score: 64, scoreColor: "text-amber-500" },
        { name: "Settings", audits: 6, score: 73, scoreColor: "text-green-500" },
        { name: "Dashboard", audits: 5, score: 55, scoreColor: "text-amber-500" },
      ].map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground w-16 truncate flex-shrink-0">{p.name}</span>
          <span className="text-muted-foreground/70 flex-shrink-0">{p.audits} audits</span>
          <span className={`font-semibold ml-auto flex-shrink-0 ${p.scoreColor}`}>{p.score}</span>
        </div>
      ))}
    </div>

    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-[11px] flex-shrink-0">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Users className="h-3 w-3 text-primary" />
        <span>4 projects · 24 audits</span>
      </div>
      <div className="flex items-center gap-1 text-primary font-medium">
        <BarChart3 className="h-3 w-3" />
        <span>Avg 68</span>
      </div>
    </div>
  </div>
);
