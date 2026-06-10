/**
 * Mirrors the server-side RETENTION_DAYS in supabase/functions/storage-cleanup.
 * Keep in sync if you change one.
 */
export const SCREENSHOT_RETENTION_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns true when an audit's screenshot has been (or is about to be) purged
 * by the storage-cleanup cron. Computed client-side from `audit.created_at`
 * so we don't need a DB column or a network round-trip.
 *
 * The cron runs weekly, so a file aged 90–96 days may still exist; the
 * `<img onError>` fallback handles that race.
 */
export function isScreenshotExpired(createdAt: string | Date | null | undefined): boolean {
  if (!createdAt) return false;
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const ageDays = (Date.now() - created.getTime()) / MS_PER_DAY;
  return ageDays >= SCREENSHOT_RETENTION_DAYS;
}
