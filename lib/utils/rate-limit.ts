import { TooManyRequestsError } from "./errors";

/**
 * Minimal fixed-window, in-process rate limiter.
 *
 * Limits are per server instance — sufficient to blunt brute force / enumeration from a single
 * client on one instance. For multi-instance deployments back this with Redis/Upstash
 * (same interface) so limits are shared.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 50_000;

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_KEYS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count++;
  if (bucket.count > limit) throw new TooManyRequestsError();
}

/** Convenience: rate-limit a request by route name + client IP. */
export function rateLimitRequest(req: Request, name: string, limit: number, windowMs: number) {
  if (process.env.DISABLE_RATE_LIMIT === "true") return;
  rateLimit(`${name}:${clientIp(req)}`, limit, windowMs);
}

export function __resetRateLimits() {
  buckets.clear();
}
