import { ImageOff } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExpiredScreenshotProps {
  title: string;
  tooltip: string;
  /** Tailwind sizing/positioning class names (e.g. "absolute inset-0" or "w-full h-full") */
  className?: string;
  /** Compact mode for small thumbnails — hides the helper line */
  compact?: boolean;
}

export function ExpiredScreenshot({
  title,
  tooltip,
  className = "w-full h-full",
  compact = false,
}: ExpiredScreenshotProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`${className} flex flex-col items-center justify-center gap-2 bg-surface-1 text-muted-foreground cursor-help`}
            role="img"
            aria-label={title}
          >
            <ImageOff className="h-8 w-8 opacity-60" aria-hidden="true" />
            <span className="text-sm font-medium">{title}</span>
            {!compact && (
              <span className="text-xs text-muted-foreground/70 px-4 text-center max-w-xs">
                90-day retention
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
