import { Sparkles, MapPin, AlertTriangle } from "lucide-react";

const mockupCardClass =
  "rounded-xl border border-border bg-card p-5 h-[280px] flex flex-col overflow-hidden";

/** Figma window mockup: canvas area + Qualia plugin panel */
export const PluginInFigmaMockup = () => (
  <div className={mockupCardClass}>
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    <div className="flex flex-1 min-h-0 gap-3">
      {/* Canvas area (left) */}
      <div className="flex-1 rounded-lg bg-surface-2 border border-border/50 p-2 flex flex-col">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2 block">
          Canvas
        </span>
        <div className="flex-1 rounded border border-dashed border-border/50 flex items-center justify-center">
          <div className="w-12 h-14 rounded bg-surface-3/80 border border-border/50" />
        </div>
        <p className="text-[9px] text-muted-foreground text-center mt-1 truncate">
          Frame selected
        </p>
      </div>

      {/* Plugin panel (right) */}
      <div className="w-[42%] rounded-lg bg-primary/5 border border-primary/20 p-2.5 flex flex-col">
        <div className="flex items-center gap-1.5 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Qualia</span>
        </div>
        <div className="h-6 rounded bg-surface-2 border border-border/50 mb-2 flex items-center px-2 text-[10px] text-muted-foreground">
          Project
        </div>
        <div className="h-6 rounded bg-surface-2 border border-border/50 mb-3 flex items-center px-2 text-[10px] text-muted-foreground">
          Screen goal (optional)
        </div>
        <div className="mt-auto rounded-md h-7 bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold">
          Analyze screen
        </div>
      </div>
    </div>
  </div>
);

/** Report as plugin panel inside Figma: canvas (left) + report in side panel (right) */
export const PluginReportMockup = () => (
  <div className={mockupCardClass}>
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    <div className="flex flex-1 min-h-0 gap-0">
      {/* Figma canvas (left) — design with a highlight to show “audited” */}
      <div className="flex-1 rounded-l-lg bg-surface-2 border border-border/50 border-r-0 p-2 flex flex-col">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2 block">
          Figma canvas
        </span>
        <div className="flex-1 rounded border border-border/50 relative overflow-hidden">
          {/* Minimal UI sketch */}
          <div className="absolute inset-2 space-y-1.5">
            <div className="h-2 w-14 bg-surface-3 rounded" />
            <div className="h-1.5 w-full bg-surface-3/60 rounded" />
            <div className="h-1.5 w-[85%] bg-surface-3/60 rounded" />
            <div className="h-5 w-full bg-surface-3 rounded mt-2" />
            <div className="h-5 w-full bg-surface-3 rounded" />
          </div>
          {/* Plugin highlight overlay — shows report is tied to this canvas */}
          <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-primary/40 border-2 border-primary flex items-center justify-center">
            <MapPin className="h-2.5 w-2.5 text-primary" />
          </div>
        </div>
      </div>

      {/* Plugin panel (right) — report as popup inside Figma */}
      <div className="w-[44%] min-w-0 rounded-r-lg bg-primary/5 border border-primary/20 border-l-2 border-l-primary/40 p-2.5 flex flex-col shadow-lg">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
          <span className="text-[10px] font-semibold text-foreground truncate">Qualia · Report</span>
        </div>
        {/* Score */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-8 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-primary">72</span>
          </div>
          <div className="flex-1 min-w-0 rounded bg-destructive/5 border border-destructive/30 px-1.5 py-1">
            <div className="flex items-center gap-1 mb-0.5">
              <AlertTriangle className="h-2.5 w-2.5 text-red-400 flex-shrink-0" />
              <span className="text-[9px] font-semibold text-red-400 truncate">One big thing</span>
            </div>
            <div className="h-1 w-full bg-surface-3/50 rounded" />
          </div>
        </div>
        {/* Issues in panel */}
        <div className="flex-grow min-h-0 rounded bg-surface-2/80 border border-border/50 p-1.5 space-y-1 overflow-hidden">
          {[
            { dot: "bg-destructive", label: "System logic" },
            { dot: "bg-amber-500", label: "Heuristic" },
            { dot: "bg-amber-500", label: "Cognitive" },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-1.5 text-[9px]">
              <div className={`w-1 h-1 rounded-full flex-shrink-0 ${row.dot}`} />
              <span className="text-muted-foreground truncate flex-1">{row.label}</span>
              <MapPin className="h-2 w-2 text-primary flex-shrink-0" />
            </div>
          ))}
        </div>
        <p className="text-[8px] text-muted-foreground text-center mt-1.5 leading-tight">
          Click issue → highlight on canvas
        </p>
      </div>
    </div>
  </div>
);
