/**
 * NOTE: This is an in-memory rate limiter. It is NOT suitable for production because
 * state resets per serverless instance/worker.
 * TODO: For production, migrate to a Redis/Upstash-based rate limiter to ensure global limits.
 */

interface RateLimitTracker {
  count: number;
  resetTime: number;
}

const rateLimitCache = new Map<string, RateLimitTracker>();

export function rateLimit(identifier: string, limit: number, windowMs: number): { success: boolean; limit: number; remaining: number } {
  const now = Date.now();
  const tracker = rateLimitCache.get(identifier);

  // Clean up expired entries to prevent memory leaks over time in a non-blocking macrotask
  if (rateLimitCache.size > 1000) {
    setTimeout(() => {
      const sweepTime = Date.now();
      rateLimitCache.forEach((val, key) => {
        if (val.resetTime < sweepTime) {
          rateLimitCache.delete(key);
        }
      });
    }, 0);
  }

  if (!tracker || tracker.resetTime < now) {
    // First request or window expired
    rateLimitCache.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return { success: true, limit, remaining: limit - 1 };
  }

  // Increment inside active window
  tracker.count++;
  
  if (tracker.count > limit) {
    return { success: false, limit, remaining: 0 };
  }

  return { success: true, limit, remaining: limit - tracker.count };
}
