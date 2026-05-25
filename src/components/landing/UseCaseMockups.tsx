import { Image, MapPin, Eye, Layers, ArrowRight, AlertTriangle, CheckCircle2, Route, FileCode, Users, Quote } from "lucide-react";

const mockupCardClass = "rounded-xl border border-border bg-card p-5 h-[280px] flex flex-col";

/** Single screen audit mockup — shows a screen with spatial pins */
export const SingleScreenMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    {/* Screen with pins */}
    <div className="relative flex-grow rounded-lg bg-surface-2 border border-border/50 p-3 mb-3">
      {/* Simulated UI skeleton */}
      <div className="h-3 w-20 bg-surface-3 rounded mb-2" />
      <div className="h-2 w-full bg-surface-3/50 rounded mb-1.5" />
      <div className="h-2 w-3/4 bg-surface-3/50 rounded mb-3" />
      <div className="h-8 w-full bg-surface-3 rounded mb-2" />
      <div className="h-8 w-full bg-surface-3 rounded mb-2" />
      <div className="h-6 w-24 bg-primary/30 rounded" />

      {/* Spatial pins */}
      <div className="absolute top-3 right-4 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px] font-bold">1</div>
      <div className="absolute top-12 left-6 w-5 h-5 rounded-full bg-amber-500 text-background flex items-center justify-center text-[10px] font-bold">2</div>
      <div className="absolute bottom-8 right-8 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px] font-bold">3</div>
    </div>

    {/* Score bar */}
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">UX Score</span>
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <div className="h-full w-[62%] bg-amber-500 rounded-full" />
        </div>
        <span className="text-sm font-semibold text-amber-500">62</span>
      </div>
    </div>
  </div>
);

/** Context images mockup — shows main screen + faded context screens */
export const ContextImagesMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 block">Context screens</span>

    {/* Three thumbnails: context → target → context */}
    <div className="flex gap-2 flex-grow items-stretch">
      {/* Context (faded) */}
      <div className="flex-1 rounded-lg bg-surface-2 border border-border/30 opacity-50 p-2 flex flex-col gap-1.5">
        <div className="h-2 w-10 bg-surface-3 rounded" />
        <div className="h-1.5 w-full bg-surface-3/50 rounded" />
        <div className="h-1.5 w-3/4 bg-surface-3/50 rounded" />
        <div className="mt-auto text-[9px] text-muted-foreground text-center">prev</div>
      </div>
      {/* Target (highlighted) */}
      <div className="flex-1 rounded-lg bg-surface-2 border-2 border-primary/60 p-2 flex flex-col gap-1.5 relative">
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[8px] px-1.5 py-0.5 rounded font-semibold">AUDITED</div>
        <div className="h-2 w-10 bg-surface-3 rounded" />
        <div className="h-1.5 w-full bg-surface-3/50 rounded" />
        <div className="h-1.5 w-3/4 bg-surface-3/50 rounded" />
        <div className="h-5 w-full bg-primary/20 rounded mt-auto" />
      </div>
      {/* Context (faded) */}
      <div className="flex-1 rounded-lg bg-surface-2 border border-border/30 opacity-50 p-2 flex flex-col gap-1.5">
        <div className="h-2 w-10 bg-surface-3 rounded" />
        <div className="h-1.5 w-full bg-surface-3/50 rounded" />
        <div className="h-1.5 w-3/4 bg-surface-3/50 rounded" />
        <div className="mt-auto text-[9px] text-muted-foreground text-center">next</div>
      </div>
    </div>

    <p className="text-[10px] text-muted-foreground text-center mt-3">
      Context screens are <span className="text-foreground/70 font-medium">not audited</span>
    </p>
  </div>
);

/** Flow analysis mockup — shows a multi-step carousel with arrows */
export const FlowAnalysisMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 block">Flow analysis</span>

    {/* Step indicators */}
    <div className="flex items-center justify-center gap-1 mb-3">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center gap-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            step === 2
              ? "bg-primary text-primary-foreground"
              : "bg-surface-3 text-muted-foreground"
          }`}>
            {step}
          </div>
          {step < 4 && <ArrowRight className="h-3 w-3 text-muted-foreground/40" />}
        </div>
      ))}
    </div>

    {/* Current step preview */}
    <div className="flex-grow rounded-lg bg-surface-2 border border-primary/40 p-2 flex flex-col gap-1 relative mb-3">
      <div className="h-2 w-12 bg-surface-3 rounded" />
      <div className="h-1.5 w-full bg-surface-3/50 rounded" />
      <div className="h-6 w-full bg-surface-3 rounded" />
      <div className="h-1.5 w-2/3 bg-surface-3/50 rounded" />
      {/* Pin on this step */}
      <div className="absolute top-2 right-3 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[9px] font-bold">!</div>
    </div>

    {/* Issue summary */}
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1 text-muted-foreground">
        <MapPin className="h-3 w-3 text-red-400" />
        <span>3 micro</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <Route className="h-3 w-3 text-amber-500" />
        <span>2 macro</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <AlertTriangle className="h-3 w-3 text-red-400" />
        <span>1 dead end</span>
      </div>
    </div>
  </div>
);

/** Prototype crawl mockup — flow + inferred design-system checks */
export const PrototypeCrawlMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 block">Prototype crawl</span>

    <div className="flex-grow grid grid-cols-[1.2fr_1fr] gap-2 mb-3">
      {/* Flow strip */}
      <div className="rounded-lg bg-surface-2 border border-border/50 p-2">
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center gap-1">
              <div className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center ${step === 2 ? "bg-primary text-primary-foreground" : "bg-surface-3 text-muted-foreground"}`}>
                {step}
              </div>
              {step < 3 ? <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50" /> : null}
            </div>
          ))}
        </div>
        <div className="h-2 w-10 bg-surface-3 rounded mb-1.5" />
        <div className="h-1.5 w-full bg-surface-3/60 rounded mb-1.5" />
        <div className="h-5 w-full bg-surface-3 rounded mb-1.5" />
        <div className="h-1.5 w-2/3 bg-surface-3/60 rounded" />
      </div>

      {/* Design system inference */}
      <div className="rounded-lg bg-surface-2 border border-primary/30 p-2">
        <span className="text-[8px] uppercase tracking-wider text-primary/90 block mb-1.5">Design system</span>
        <div className="space-y-1.5 text-[8px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Button styles</span>
            <span className="text-green-400">OK</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Spacing scale</span>
            <span className="text-amber-300">drift</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Color tokens</span>
            <span className="text-red-400">mismatch</span>
          </div>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
      <Route className="h-3 w-3 text-primary" />
      <span>Flow + transitions</span>
      <span className="text-foreground/40">·</span>
      <FileCode className="h-3 w-3 text-primary" />
      <span>System consistency</span>
    </div>
  </div>
);

/** Synth user research mockup — shows personas with verdicts and inner monologue */
export const SynthUsersMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 block">
      Synth user research
    </span>

    {/* Persona verdict rows */}
    <div className="flex-grow rounded-lg bg-surface-2 border border-border/50 p-2 mb-3 space-y-1.5">
      {[
        { name: "Power User", verdict: "FRICTION", color: "bg-amber-500", badge: "FRICTION" },
        { name: "Daily Driver", verdict: "PASS", color: "bg-green-500", badge: "PASS" },
        { name: "Admin Gatekeeper", verdict: "BLOCKER", color: "bg-red-500", badge: "BLOCKER" },
      ].map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-2 text-[9px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`h-2 w-2 rounded-full ${p.color}`} />
            <span className="font-medium text-foreground/90 truncate">{p.name}</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[8px] font-semibold ${
              p.verdict === "PASS"
                ? "border-green-500/40 text-green-400 bg-green-500/10"
                : p.verdict === "FRICTION"
                ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                : "border-red-500/40 text-red-400 bg-red-500/10"
            }`}
          >
            {p.badge}
          </span>
        </div>
      ))}
    </div>

    {/* Inner monologue snippet */}
    <div className="rounded-lg bg-primary/5 border border-primary/30 px-2.5 py-2 flex gap-2 items-start">
      <div className="mt-0.5">
        <Quote className="h-3 w-3 text-primary/60" />
      </div>
      <p className="text-[9px] text-foreground/80 leading-snug line-clamp-3">
        “I'm not sure where to click next. The main action blends in with the secondary buttons, so I hesitate before moving forward.”
      </p>
    </div>
  </div>
);

/** Deep Figma UI mockup — shows Figma metadata feeding element-level feedback */
export const DeepFigmaMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 block">Figma metadata</span>

    {/* Node tree snippet */}
    <div className="flex-grow rounded-lg bg-surface-2 border border-border/50 p-2.5 mb-3 font-mono text-[9px] text-left space-y-0.5">
      <div className="text-muted-foreground">Frame "Checkout"</div>
      <div className="pl-2 text-muted-foreground/80">├─ Button "Submit"</div>
      <div className="pl-2 text-muted-foreground/80">├─ Text "Total"</div>
      <div className="pl-2 text-muted-foreground/80">└─ Card #a1b2</div>
    </div>

    {/* Badge + outcome */}
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-[9px] font-medium text-primary">
        <FileCode className="h-3 w-3" />
        Deep Figma UI
      </span>
      <span className="text-[9px] text-muted-foreground">→ element-level feedback</span>
    </div>
  </div>
);

/** Compact mockups for the Enhancements section — fixed height, no flex-grow */
const compactCardClass = "rounded-xl border border-border bg-card p-4 h-[160px] flex flex-col";

export const ContextImagesMockupCompact = () => (
  <div className={compactCardClass}>
    <div className="flex gap-1 mb-2">
      <div className="w-2 h-2 rounded-full bg-destructive/60" />
      <div className="w-2 h-2 rounded-full bg-amber-500/60" />
      <div className="w-2 h-2 rounded-full bg-green-500/60" />
    </div>
    <span className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2 block">Context screens</span>
    <div className="flex gap-1.5 flex-1 min-h-0">
      <div className="flex-1 rounded bg-surface-2 border border-border/30 opacity-50 p-1.5" />
      <div className="flex-1 rounded bg-surface-2 border-2 border-primary/50 p-1.5 relative">
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[7px] px-1 rounded font-medium">Target</span>
      </div>
      <div className="flex-1 rounded bg-surface-2 border border-border/30 opacity-50 p-1.5" />
    </div>
    <p className="text-[8px] text-muted-foreground text-center mt-1.5">Reference only · not audited</p>
  </div>
);

export const DeepFigmaMockupCompact = () => (
  <div className={compactCardClass}>
    <div className="flex gap-1 mb-2">
      <div className="w-2 h-2 rounded-full bg-destructive/60" />
      <div className="w-2 h-2 rounded-full bg-amber-500/60" />
      <div className="w-2 h-2 rounded-full bg-green-500/60" />
    </div>
    <span className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2 block">Figma metadata</span>
    <div className="flex-1 min-h-0 rounded bg-surface-2 border border-border/50 p-2 font-mono text-[8px] text-muted-foreground space-y-0.5">
      <div>Frame → Button, Text, Card</div>
      <div className="text-primary font-medium">→ element-level feedback</div>
    </div>
    <div className="mt-1.5 flex justify-center">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 border border-primary/30 text-[8px] font-medium text-primary">
        <FileCode className="h-2.5 w-2.5" /> Deep Figma UI
      </span>
    </div>
  </div>
);

export const SynthUsersMockupCompact = () => (
  <div className={compactCardClass}>
    <div className="flex gap-1 mb-2">
      <div className="w-2 h-2 rounded-full bg-destructive/60" />
      <div className="w-2 h-2 rounded-full bg-amber-500/60" />
      <div className="w-2 h-2 rounded-full bg-green-500/60" />
    </div>
    <span className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2 block">Synth users</span>
    <div className="flex-1 min-h-0 rounded bg-surface-2 border border-border/50 p-2 space-y-1.5 text-[8px]">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Power User</span>
        <span className="text-amber-300">FRICTION</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Daily Driver</span>
        <span className="text-green-400">PASS</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Admin</span>
        <span className="text-red-400">BLOCKER</span>
      </div>
    </div>
    <p className="text-[8px] text-muted-foreground text-center mt-1.5">Persona lens on top of audit</p>
  </div>
);
