import redis from '@/lib/redis';
import crypto from 'crypto';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
}

/**
 * Distributed rate limiter using Upstash Redis.
 * Falls back to rejecting (fail closed) if misconfigured in production.
 */
export async function distributedRateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Verify Redis is configured
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (isProduction) {
      console.error(`[RateLimit] Failed closed: Upstash Redis is not configured in production.`);
      return { success: false, limit, remaining: 0 };
    } else {
      console.warn(`[RateLimit] Bypassing rate limit in development due to missing Upstash config.`);
      return { success: true, limit, remaining: limit - 1 };
    }
  }

  // Hash the identifier with a secret to avoid leaking raw phone/IP/token in Redis keys
  const secret = process.env.AUTH_HASH_SECRET || process.env.API_SECRET_KEY || 'default_dev_secret';
  const hashedIdentifier = crypto.createHmac('sha256', secret).update(identifier).digest('hex');
  
  const key = `rl:${bucket}:${hashedIdentifier}`;
  const windowSecs = Math.ceil(windowMs / 1000);

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSecs);
    }

    if (current > limit) {
      return { success: false, limit, remaining: 0 };
    }

    return { success: true, limit, remaining: limit - current };
  } catch (error) {
    console.error(`[RateLimit] Upstash Redis query failed:`, error);
    if (isProduction) {
      // Fail closed policy for authentication routes
      return { success: false, limit, remaining: 0 };
    }
    return { success: true, limit, remaining: limit - 1 };
  }
}
