import React from "react";

type Variant = "high" | "medium" | "low" | "engine" | "info" | "new" | "still";

type Props = { variant: Variant; children: React.ReactNode };

const classes: Record<Variant, string> = {
  high:   "bg-red-500/20 text-red-400",
  medium: "bg-amber-500/20 text-amber-400",
  low:    "bg-green-500/20 text-green-400",
  engine: "bg-surface-2 text-foreground/65",
  info:   "bg-primary/20 text-primary",
  new:    "bg-green-500/20 text-green-400",
  still:  "bg-surface-2 text-foreground/65",
};

export function Badge({ variant, children }: Props) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${classes[variant]}`}>
      {children}
    </span>
  );
}
