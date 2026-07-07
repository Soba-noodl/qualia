import { useId } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeConfig = {
  sm: {
    icon: "h-5 w-5",
    text: "text-lg",
    gap: "gap-1",
  },
  md: {
    icon: "h-6 w-6",
    text: "text-xl",
    gap: "gap-1",
  },
  lg: {
    icon: "h-8 w-8",
    text: "text-2xl",
    gap: "gap-1.5",
  },
};

const STAR_PATH =
  "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z";

/** Sparkles icon with gradient fill – main star + small stars (same shape, scaled). Use for Qualia branding. */
export const LogoIcon = ({ className }: { className?: string }) => {
  const gradientId = useId();
  const starId = useId();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-2 -2 28 28"
      fill="none"
      stroke="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="hsl(262 83% 72%)" />
          <stop offset="50%" stopColor="hsl(262 83% 58%)" />
          <stop offset="100%" stopColor="hsl(262 70% 45%)" />
        </linearGradient>
        <path id={starId} d={STAR_PATH} />
      </defs>
      <use href={`#${starId}`} fill={`url(#${gradientId})`} />
      <use
        href={`#${starId}`}
        fill={`url(#${gradientId})`}
        transform="translate(20,5) scale(0.45) translate(-12,-12)"
      />
      <use
        href={`#${starId}`}
        fill={`url(#${gradientId})`}
        transform="translate(3.5,18.38) scale(0.45) translate(-12,-12)"
      />
    </svg>
  );
};

const Logo = ({ size = "md", className }: LogoProps) => {
  const config = sizeConfig[size];
  
  return (
    <div className={cn("flex items-center", config.gap, className)}>
      <LogoIcon className={cn(config.icon, "shrink-0")} />
      <span
        className={cn(config.text, "font-bold", "text-gradient")}
      >
        Qualia
      </span>
    </div>
  );
};

export default Logo;
