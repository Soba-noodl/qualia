/**
 * Quota checking utilities for user audit limits.
 * Implements Step 1: The Gatekeeper - check quota BEFORE any Figma operations.
 */

// Use generic type to avoid version mismatch with SupabaseClient across edge functions
// deno-lint-ignore no-explicit-any
type AnySupabaseClient = any;

// Sentinel for unlimited plans — chosen to be finite so JSON.stringify
// emits a real number (Infinity → null on the wire), and large enough
// that any subtraction stays positive. Consumers must gate on
// `isUnlimited` rather than treating this as a real cap.
const UNLIMITED_SENTINEL = 9999;

// Plan limits — can be extended for different tiers
const PLAN_LIMITS = {
  free: 2,
  pro: UNLIMITED_SENTINEL,
} as const;

interface QuotaCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  isAdmin: boolean;
  /** True when the plan has no effective daily cap (admin today; pro in the future). */
  isUnlimited: boolean;
}

/**
 * Get the start of the current day in Europe/Rome timezone.
 * Used for daily quota reset.
 */
function getTodayStartRome(): string {
  const now = new Date();
  // Get today's date in Rome timezone
  const todayRome = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
  return `${todayRome}T00:00:00+00:00`;
}

/**
 * Check if user has quota remaining for audits today.
 * This should be called BEFORE attempting any Figma operations.
 */
export async function checkUserQuota(
  supabase: AnySupabaseClient,
  userId: string
): Promise<QuotaCheckResult> {
  const todayStart = getTodayStartRome();

  // Check if user is admin by directly querying user_roles
  // (we use the service client here, so auth.uid() is not set — skip the RPC)
  const { data: adminRow } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (adminRow) {
    return {
      allowed: true,
      currentCount: 0,
      limit: UNLIMITED_SENTINEL,
      isAdmin: true,
      isUnlimited: true,
    };
  }

  // Step 1: Release slots held by audits stuck in pending/processing for >45 min
  const staleThreshold = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const { error: cleanupError } = await supabase
    .from('audits')
    .update({ status: 'failed', error_message: 'Audit timed out' })
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .lt('created_at', staleThreshold);

  if (cleanupError) {
    console.error('Stale audit cleanup failed (non-fatal):', cleanupError);
  }

  // Step 2: Count today's non-failed audits — pending + processing + completed all reserve a slot
  const { count, error } = await supabase
    .from('audits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'failed')
    .gte('created_at', todayStart);

  if (error) {
    console.error('Error checking quota:', error);
    return {
      allowed: false,
      currentCount: 0,
      limit: PLAN_LIMITS.free,
      isAdmin: false,
      isUnlimited: false,
    };
  }

  const currentCount = count || 0;
  const limit = PLAN_LIMITS.free;

  return {
    allowed: currentCount < limit,
    currentCount,
    limit,
    isAdmin: false,
    isUnlimited: false,
  };
}
