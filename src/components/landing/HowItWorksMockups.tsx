import { Upload, Users, AlertTriangle, KeyRound } from "lucide-react";

const mockupCardClass = "rounded-xl border border-border bg-card p-4 mb-6 h-[232px] flex flex-col";

// Mockup 1: Connect / upload interface
export const UploadMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    {/* OAuth connect button */}
    <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 mb-3">
      <svg viewBox="0 0 38 57" className="h-4 w-4 flex-shrink-0" fill="none">
        <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE"/>
        <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
        <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
        <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
        <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/>
      </svg>
      <span className="text-sm font-medium text-primary">Sign in with Figma</span>
    </div>

    {/* Divider */}
    <div className="flex items-center gap-2 mb-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] text-muted-foreground">or</span>
      <div className="flex-1 h-px bg-border" />
    </div>

    {/* Drop zone */}
    <div className="border-2 border-dashed border-primary/40 rounded-lg p-4 flex flex-col items-center justify-center flex-grow">
      <Upload className="h-6 w-6 text-primary/60 mb-1.5" />
      <span className="text-sm text-muted-foreground">Drop screenshots</span>
    </div>
  </div>
);

// Mockup 2: Persona selection interface
export const PersonaMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>
    
    {/* Select personas label */}
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 block">Select personas</span>
    
    {/* Persona badges */}
    <div className="flex flex-wrap gap-2 mb-3 flex-grow content-start">
      <div className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm h-fit">
        <Users className="h-3.5 w-3.5" />
        Admin
      </div>
      <div className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm h-fit">
        <Users className="h-3.5 w-3.5" />
        End User
      </div>
      <div className="flex items-center gap-1.5 bg-surface-2 text-foreground/70 px-3 py-1.5 rounded-md text-sm h-fit">
        HR Manager
      </div>
      <div className="flex items-center gap-1.5 bg-surface-2 text-foreground/70 px-3 py-1.5 rounded-md text-sm h-fit">
        Auditor
      </div>
    </div>
    
    {/* Selected count */}
    <div className="bg-primary/20 text-primary text-sm text-center py-2 rounded-md mt-auto">
      2 personas selected
    </div>
  </div>
);

// Mockup 3: Analysis results interface
export const ResultsMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-4">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>
    
    {/* Header with label and risk badge */}
    <div className="flex items-center justify-between mb-3">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Analysis result</span>
      <div className="flex items-center gap-1 bg-destructive/20 text-red-400 px-2 py-1 rounded text-xs">
        <AlertTriangle className="h-3 w-3" />
        High risk
      </div>
    </div>
    
    {/* Score section */}
    <div className="flex items-center gap-4 mb-4 flex-grow">
      <div className="relative">
        <svg className="w-14 h-14 -rotate-90">
          <circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="hsl(var(--surface-2))"
            strokeWidth="5"
          />
          <circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="hsl(var(--destructive))"
            strokeWidth="5"
            strokeDasharray={`${42 * 1.51} 151`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-red-400">42</span>
      </div>
      <div>
        <div className="font-semibold text-foreground text-sm">UX Score</div>
        <div className="text-xs text-muted-foreground">Critical issues detected</div>
      </div>
    </div>
    
    {/* Issue counts */}
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 rounded-full bg-destructive" />
        <span className="text-muted-foreground">3 High-impact issues</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="text-muted-foreground">5 Medium-impact issues</span>
      </div>
    </div>
  </div>
);

// Mockup 4: Add AI key (Settings → AI Providers)
export const KeyPasteMockup = () => (
  <div className={mockupCardClass}>
    {/* Window dots */}
    <div className="flex gap-1.5 mb-3">
      <div className="w-3 h-3 rounded-full bg-destructive/60" />
      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
    </div>

    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 block">
      AI Providers
    </span>

    {/* Provider rows — Gemini highlighted as "active" */}
    <div className="flex-grow space-y-1.5">
      <div className="flex items-center justify-between rounded-md bg-primary/10 border border-primary/40 px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] text-foreground">Gemini</span>
        </div>
        <span className="text-[9px] text-primary font-medium">AIza•••</span>
      </div>

      <div className="flex items-center justify-between rounded-md bg-surface-2 border border-border/50 px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-surface-3" />
          <span className="text-[11px] text-muted-foreground">GPT</span>
        </div>
        <span className="text-[9px] text-muted-foreground">Not configured</span>
      </div>
    </div>

    {/* Save & test button */}
    <div className="mt-2 flex justify-end">
      <div className="rounded-md bg-primary text-primary-foreground text-[10px] font-semibold px-2.5 py-1">
        Save &amp; test
      </div>
    </div>
  </div>
);
