/**
 * A lightweight, in-memory rate limiter for Next.js API Routes.
 * Note: Since this is in-memory, it will reset when the server restarts
 * or if deployed in a Serverless environment it is scoped per-instance.
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
