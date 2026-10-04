/**
 * Client-side rate limiting for xAI calls.
 * Prevents accidental double-scans and rapid-fire rewrites from burning credits.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsed * this.refillPerMs
    );
    this.lastRefill = now;
  }

  tryTake(cost = 1): RateLimitResult {
    this.refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return {
        allowed: true,
        retryAfterMs: 0,
        remaining: Math.floor(this.tokens),
      };
    }
    const need = cost - this.tokens;
    const retryAfterMs = Math.ceil(need / this.refillPerMs);
    return {
      allowed: false,
      retryAfterMs,
      remaining: 0,
    };
  }
}

/** ~8 full analyses per minute, burst of 3 */
export const analysisLimiter = new TokenBucket(3, 8 / 60_000);

/** ~20 rewrites per minute, burst of 5 */
export const rewriteLimiter = new TokenBucket(5, 20 / 60_000);
