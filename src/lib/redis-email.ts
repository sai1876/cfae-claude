import { Redis } from '@upstash/redis'

const redisEmail = new Redis({
  url: process.env.UPSTASH_REDIS_EMAIL_REST_URL!,
  token: process.env.UPSTASH_REDIS_EMAIL_REST_TOKEN!,
})

export default redisEmail;
