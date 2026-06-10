import React from "react";

const STAR_PATH = "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z";

export function QualiaLogo() {
  return (
    <div className="flex items-center gap-1.5">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 28 28" width="18" height="18" fill="none">
        <defs>
          <linearGradient id="ql-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(262 83% 72%)" />
            <stop offset="100%" stopColor="hsl(262 70% 45%)" />
          </linearGradient>
        </defs>
        <path d={STAR_PATH} fill="url(#ql-grad)" />
      </svg>
      <span className="font-bold text-[14px]" style={{ background: "linear-gradient(135deg, hsl(262 83% 72%), hsl(262 70% 45%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        Qualia
      </span>
    </div>
  );
}

export function BackButton({ onClick, label = "← Back", disabled }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-[14px] text-foreground/65 hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
    >
      {label}
    </button>
  );
}

type Props = {
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
};

export function PluginShell({ leftAction, rightAction, children }: Props) {
  return (
    <div className="flex flex-col bg-background text-foreground font-sans" style={{ minHeight: "100vh" }}>
      <header className="relative flex items-center px-4 py-3.5 border-b border-border flex-shrink-0">
        {leftAction ? (
          <>
            <div className="flex items-center">{leftAction}</div>
            <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
              <QualiaLogo />
            </div>
          </>
        ) : (
          <QualiaLogo />
        )}
        {rightAction && <div className="ml-auto flex items-center gap-2.5">{rightAction}</div>}
      </header>
      <div className="flex-1 flex flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
