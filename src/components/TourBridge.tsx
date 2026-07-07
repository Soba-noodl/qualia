import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight } from "lucide-react";
import { useTourState } from "@/contexts/TourStateContext";
import type { BridgeName } from "@/contexts/TourStateContext";

interface TourBridgeProps {
  /** Which bridge this is — determines show/hide/persist logic */
  bridgeName: BridgeName;
  /** CSS selector for the element to highlight (e.g. '[data-tour="create-project"]') */
  targetSelector: string;
  /** Label text shown in the floating callout */
  label: string;
  /** Where to place the callout relative to the target. Default: "bottom" */
  position?: "top" | "bottom" | "left" | "right";
}

interface LabelCoords {
  top: number;
  left: number;
  arrowSide: "top" | "bottom" | "left" | "right";
}

const GAP = 10; // px between element edge and callout

export function TourBridge({
  bridgeName,
  targetSelector,
  label,
  position = "bottom",
}: TourBridgeProps) {
  const { shouldShowBridge, markBridgeCompleted, markBridgeDismissed } =
    useTourState();

  const [coords, setCoords] = useState<LabelCoords | null>(null);
  const [visible, setVisible] = useState(false);
  const targetRef = useRef<Element | null>(null);
  const unmountedRef = useRef(false);

  const show = shouldShowBridge(bridgeName);

  const computeCoords = useCallback(() => {
    // eslint-disable-next-line no-restricted-syntax -- REACT-004: tour overlay targets external tour anchors by selector
    const el = document.querySelector(targetSelector);
    if (!el) return;
    const rect = el.getBoundingClientRect();

    let top = 0;
    let left = 0;
    let arrowSide: LabelCoords["arrowSide"] = "top";

    switch (position) {
      case "bottom":
        top = rect.bottom + GAP;
        left = rect.left + rect.width / 2;
        arrowSide = "top";
        break;
      case "top":
        top = rect.top - GAP;
        left = rect.left + rect.width / 2;
        arrowSide = "bottom";
        break;
      case "right":
        top = rect.top + rect.height / 2;
        left = rect.right + GAP;
        arrowSide = "left";
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - GAP;
        arrowSide = "right";
        break;
    }

    setCoords({ top, left, arrowSide });
  }, [targetSelector, position]);

  // Find element, add ring class, wire click handler
  useEffect(() => {
    if (!show) return;
    unmountedRef.current = false;

    let retryTimeout: ReturnType<typeof setTimeout>;

    const attach = () => {
      // eslint-disable-next-line no-restricted-syntax -- REACT-004: tour overlay targets external tour anchors by selector
      const el = document.querySelector(targetSelector);
      if (!el) {
        // Retry for up to 3s in case element mounts later
        retryTimeout = setTimeout(attach, 300);
        return;
      }

      targetRef.current = el;
      el.classList.add("tour-bridge-ring");
      computeCoords();

      if (!unmountedRef.current) setVisible(true);

      const handleClick = () => {
        if (unmountedRef.current) return;
        markBridgeCompleted(bridgeName);
      };

      el.addEventListener("click", handleClick, { once: true });

      // Cleanup stored on element so we can remove it
      (el as HTMLElement & { _bridgeClickHandler?: () => void })._bridgeClickHandler =
        handleClick;
    };

    attach();

    // Reposition on scroll / resize
    const handleReposition = () => computeCoords();
    window.addEventListener("scroll", handleReposition, { passive: true, capture: true });
    window.addEventListener("resize", handleReposition, { passive: true });

    return () => {
      unmountedRef.current = true;
      clearTimeout(retryTimeout);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);

      const el = targetRef.current;
      if (el) {
        el.classList.remove("tour-bridge-ring");
        const h = (el as HTMLElement & { _bridgeClickHandler?: () => void })
          ._bridgeClickHandler;
        if (h) {
          el.removeEventListener("click", h);
          delete (el as HTMLElement & { _bridgeClickHandler?: () => void })
            ._bridgeClickHandler;
        }
      }
      targetRef.current = null;
      setVisible(false);
    };
  }, [show, targetSelector, bridgeName, computeCoords, markBridgeCompleted]);

  const handleDismiss = useCallback(() => {
    markBridgeDismissed(bridgeName);
  }, [markBridgeDismissed, bridgeName]);

  if (!show || !visible || !coords) return null;

  const { top, left, arrowSide } = coords;

  // Arrow CSS
  const arrowStyles: Record<string, React.CSSProperties> = {
    top: {
      top: -6,
      left: "50%",
      transform: "translateX(-50%) rotate(45deg)",
    },
    bottom: {
      bottom: -6,
      left: "50%",
      transform: "translateX(-50%) rotate(45deg)",
    },
    left: {
      left: -6,
      top: "50%",
      transform: "translateY(-50%) rotate(45deg)",
    },
    right: {
      right: -6,
      top: "50%",
      transform: "translateY(-50%) rotate(45deg)",
    },
  };

  // Translate the callout so it's centered (for top/bottom) or middle-aligned (for left/right)
  const transformStyle =
    position === "bottom" || position === "top"
      ? "translateX(-50%)"
      : position === "left"
      ? "translateX(-100%)"
      : "translateX(0)";

  const topOffset = position === "top" ? `calc(${top}px - 100%)` : `${top}px`;

  return createPortal(
    <div
      className="fixed pointer-events-none"
      style={{ zIndex: 9999, top: 0, left: 0, width: "100vw", height: "100vh" }}
    >
      <div
        className="absolute pointer-events-auto"
        style={{
          top: topOffset,
          left,
          transform: transformStyle,
        }}
      >
        {/* Callout box */}
        <div
          className="relative flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 shadow-2xl"
          style={{
            background: "hsl(262 30% 10%)",
            border: "1px solid hsl(262 83% 58% / 0.45)",
            boxShadow:
              // eslint-disable-next-line no-restricted-syntax -- DS-SHADOW-002: third-party tour tooltip; no named shadow token covers this inline CSS-in-JS context
              "0 4px 24px hsl(262 83% 58% / 0.18), 0 1px 4px rgba(0,0,0,0.5)",
            whiteSpace: "nowrap",
          }}
        >
          {/* Arrow */}
          <div
            className="absolute w-3 h-3"
            style={{
              ...arrowStyles[arrowSide],
              background: "hsl(262 83% 58% / 0.45)",
              border: "1px solid hsl(262 83% 58% / 0.45)",
              backgroundClip: "padding-box",
            }}
          />

          <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(262 83% 68%)" }} />

          <span
            className="text-sm font-medium"
            style={{ color: "hsl(262 30% 90%)" }}
          >
            {label}
          </span>

          {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: tour bridge dismiss button uses inline JS style for hover color via onMouseEnter/Leave with hsl(262 30% …) tokens; no Tailwind hover utility; Button's variant color system would override the bespoke tour overlay palette */}
          <button
            onClick={handleDismiss}
            className="ml-1 shrink-0 rounded p-0.5 transition-colors"
            style={{ color: "hsl(262 30% 55%)" }}
            onMouseEnter={(e) =>
              // eslint-disable-next-line no-restricted-syntax -- REACT-004: inline hover style on tour bridge dismiss button (small surface, not worth a hover: utility class)
              ((e.currentTarget as HTMLButtonElement).style.color =
                "hsl(262 30% 80%)")
            }
            onMouseLeave={(e) =>
              // eslint-disable-next-line no-restricted-syntax -- REACT-004: inline hover style on tour bridge dismiss button
              ((e.currentTarget as HTMLButtonElement).style.color =
                "hsl(262 30% 55%)")
            }
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
