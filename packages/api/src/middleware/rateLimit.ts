import { createMiddleware } from "hono/factory";
import type { Context } from "hono";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  key?: (c: Context) => string;
  message?: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function defaultKey(c: Context): string {
  const forwardedFor = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const auth = c.req.header("authorization");
  return auth ?? forwardedFor ?? c.req.header("cf-connecting-ip") ?? "unknown";
}

export function rateLimit(options: RateLimitOptions) {
  return createMiddleware(async (c, next) => {
    const now = Date.now();
    const rawKey = options.key?.(c) ?? defaultKey(c);
    const key = `${options.keyPrefix}:${rawKey}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      await next();
      return;
    }

    if (bucket.count >= options.max) {
      c.header("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return c.json({ error: options.message ?? "Too many requests" }, 429);
    }

    bucket.count += 1;
    await next();
  });
}
