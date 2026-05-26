import React from "react";

type Props = { highlighted?: boolean; className?: string; onClick?: () => void; ariaLabel?: string; children: React.ReactNode };

export function Card({ highlighted = false, className = "", onClick, ariaLabel, children }: Props) {
  const base = "rounded-xl border p-3.5";
  const colors = highlighted
    ? "bg-primary-muted border-primary/50 shadow-[0_0_16px_hsl(262_83%_58%_/_0.08)]"
    : "bg-surface-1 border-border";
  const interactive = onClick
    ? "cursor-pointer hover:border-primary/50 hover:bg-primary/10 hover:scale-[1.02] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    : "";
  const interactiveProps = onClick
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": ariaLabel,
        onClick,
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};
  return (
    <div className={[base, colors, interactive, className].filter(Boolean).join(" ")} {...interactiveProps}>
      {children}
    </div>
  );
}
