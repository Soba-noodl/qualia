import type React from "react";
import { cn } from '@/lib/utils';

const FOCUS_VISIBLE_RECIPE =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/**
 * Returns props for custom click targets that are not native `<button>` elements.
 * Provides role, tabIndex, keyboard handler (Enter/Space), and the project's
 * standard focus-visible recipe so the element is keyboard-accessible by default.
 *
 * Callers may pass an optional `extraClassName` that is merged with the
 * focus-visible recipe via `cn()`.
 *
 * DS-A11Y-003: non-button click targets need role, tabIndex, and keyboard handler.
 * DS-A11Y-005: custom click targets need focus-visible styling.
 */
export function clickableProps(handler: () => void, extraClassName?: string) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    className: cn(FOCUS_VISIBLE_RECIPE, extraClassName),
    onClick: handler,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    },
  };
}
