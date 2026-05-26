/**
 * Lightweight in-memory token-bucket rate limiter.
 * Suitable for per-user throttling within a single Edge Function instance.
 * State does not survive cold starts — this is a best-effort defence layer,
 * not a billing control (quota-check.ts handles that separately).
 *
 * Usage:
 *   const limiter = new RateLimiter({ windowMs: 60_000, max: 10 });
 *   if (limiter.isLimited(userId)) { return 429 response; }
 */

interface LimiterOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed in the window */
  max: number;
}

export class RateLimiter {
  private readonly windowMs: number;
  private readonly max: number;
  private readonly store = new Map<string, number[]>();

  constructor(opts: LimiterOptions) {
    this.windowMs = opts.windowMs;
    this.max = opts.max;
  }

  isLimited(key: string): boolean {
    const now = Date.now();
    const timestamps = (this.store.get(key) ?? []).filter(
      (t) => now - t < this.windowMs
    );
    if (timestamps.length >= this.max) {
      this.store.set(key, timestamps);
      return true;
    }
    timestamps.push(now);
    this.store.set(key, timestamps);
    return false;
  }
}
