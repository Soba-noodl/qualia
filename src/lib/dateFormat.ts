/**
 * Locale-neutral date formatting for global products (avoids MM/DD vs DD/MM ambiguity).
 * Uses "d MMM yyyy" (e.g. 23 Feb 2025) per Google style for dates and times.
 */
import { format as dateFnsFormat, formatDistanceToNow } from "date-fns";
import type { Locale } from "date-fns";

/** Date only: e.g. "23 Feb 2025" */
export function formatDate(date: Date | string | number): string {
  const d = typeof date === "object" && "getTime" in date ? date : new Date(date);
  return dateFnsFormat(d, "d MMM yyyy");
}

/** Date and time: e.g. "23 Feb 2025, 14:30" */
export function formatDateTime(date: Date | string | number): string {
  const d = typeof date === "object" && "getTime" in date ? date : new Date(date);
  return dateFnsFormat(d, "d MMM yyyy, HH:mm");
}

/** Relative time: e.g. "2 days ago", "3 months ago" */
export function formatRelativeTime(date: Date | string | number, locale?: Locale): string {
  const d = typeof date === "object" && "getTime" in date ? date : new Date(date);
  return formatDistanceToNow(d, { addSuffix: true, locale });
}

/** Date range (from–to): e.g. "23 Feb 2025 - 2 Mar 2025" */
export function formatDateRange(from: Date, to: Date): string {
  return `${dateFnsFormat(from, "d MMM yyyy")} - ${dateFnsFormat(to, "d MMM yyyy")}`;
}
