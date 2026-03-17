import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import 'dotenv/config'

// export const redis = Redis.fromEnv();

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.fixedWindow(25, "5 h"),
  analytics: true,
});

export const increaseLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.fixedWindow(1, "24 h"),
  analytics: true,
});

export const askLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.fixedWindow(1, "1 h"),
  analytics: true,
});