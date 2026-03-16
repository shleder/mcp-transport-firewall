import type { RateLimiterConfig } from "../config/schema.js";
import { RateLimitExceededError } from "../errors.js";
import { logger } from "../logger.js";

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();

  constructor(private readonly config: RateLimiterConfig) {}

  consume(key: string = "global", tokens: number = 1): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    const maxTokens = this.config.maxRequests;
    const refillRateMs = this.config.windowMs / maxTokens;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    } else {
      
      const timePassed = now - bucket.lastRefill;
      const refill = Math.floor(timePassed / refillRateMs);
      if (refill > 0) {
        bucket.tokens = Math.min(maxTokens, bucket.tokens + refill);
        bucket.lastRefill = now;
      }
    }

    if (bucket.tokens < tokens) {
      logger.warn(`🛑 Rate Limiter: Limit exceeded for [${key}]. Waiting for refill.`);
      throw new RateLimitExceededError(this.config.maxRequests, this.config.windowMs);
    }

    bucket.tokens -= tokens;
  }
}
