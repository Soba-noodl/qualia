import React from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

type Props = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
  onClick?: () => void;
  children: React.ReactNode;
};

const variantClasses: Record<Variant, string> = {
  primary:   "bg-primary text-white hover:opacity-90 active:opacity-80",
  secondary: "bg-surface-2 border border-border text-foreground/65 hover:text-foreground",
  ghost:     "bg-transparent text-foreground/65 hover:text-foreground hover:bg-surface-2",
};

const sizeClasses: Record<Size, string> = {
  md: "h-9 px-4 text-[14px]",
  sm: "h-7 px-3 text-[13px]",
};

export function Button({ variant = "primary", size = "md", loading = false, disabled = false, type = "button", className = "", title, onClick, children }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all",
        "disabled:opacity-40 disabled:pointer-events-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(" ")}
    >
      {loading ? (
        <svg className="w-3.5 h-3.5" style={{ animation: "spin 0.8s linear infinite" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 12a9 9 0 1 1-6.22-8.56" />
        </svg>
      ) : children}
    </button>
  );
}
