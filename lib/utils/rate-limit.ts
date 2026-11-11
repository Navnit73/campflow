import mongoose, { Schema } from "mongoose";
import { TooManyRequestsError } from "./errors";

/**
 * Fixed-window rate limiter backed by MongoDB, so limits are shared by every server instance
 * (previously in-process only). One atomic upsert per check; windows expire via a TTL index.
 * Falls back to an in-process window if the database is unreachable (fail-open on infra errors,
 * but still limited per instance).
 */
interface IRateLimit {
  _id: string;
  count: number;
  expiresAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, collection: "rate_limits" }
);
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit =
  (mongoose.models.RateLimit as mongoose.Model<IRateLimit>) ||
  mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);

const memory = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 50_000;

function memoryHit(key: string, windowMs: number): number {
  const now = Date.now();
  const bucket = memory.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (memory.size >= MAX_KEYS) memory.clear();
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  return ++bucket.count;
}

async function mongoHit(key: string, windowMs: number): Promise<number> {
  const now = new Date();
  const update = [
    {
      $set: {
        count: { $cond: [{ $gt: ["$expiresAt", now] }, { $add: ["$count", 1] }, 1] },
        expiresAt: { $cond: [{ $gt: ["$expiresAt", now] }, "$expiresAt", new Date(now.getTime() + windowMs)] },
      },
    },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const doc = await RateLimit.findOneAndUpdate({ _id: key }, update, {
        upsert: true,
        returnDocument: "after",
        updatePipeline: true,
      }).lean();
      return doc!.count;
    } catch (err: unknown) {
      if ((err as { code?: number })?.code !== 11000) throw err; // concurrent first hit → retry once
    }
  }
  throw new Error("rate limit upsert contention");
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  let count: number;
  try {
    const { connectDB } = await import("@/lib/db/connection");
    await connectDB();
    count = await mongoHit(key, windowMs);
  } catch {
    count = memoryHit(key, windowMs);
  }
  if (count > limit) throw new TooManyRequestsError();
}

/** Rate-limit a request by route name + client IP. */
export async function rateLimitRequest(req: Request, name: string, limit: number, windowMs: number) {
  if (process.env.DISABLE_RATE_LIMIT === "true") return;
  await rateLimit(`${name}:${clientIp(req)}`, limit, windowMs);
}

export async function __resetRateLimits() {
  memory.clear();
  await RateLimit.deleteMany({}).catch(() => {});
}
