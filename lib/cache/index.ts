import mongoose, { Schema } from "mongoose";

/**
 * Read-through cache for expensive, staleness-tolerant aggregates (dashboard, reports, public
 * catalog data). NEVER used for availability, the tape chart, or anything on the booking path.
 *
 * Correctness across instances — generation-based invalidation:
 *   every cache key embeds the scope's generation (e.g. a property). Writes call `invalidate(scope)`,
 *   which atomically increments the generation in MongoDB, so all instances stop using old entries.
 *   Each instance memoizes a scope's generation for at most GENERATION_MEMO_MS (1s) to avoid a DB
 *   round-trip per hit; the invalidating instance updates its memo immediately.
 *
 * Stampede protection: concurrent misses for the same key share one in-flight load (single-flight).
 * Storage: in-process LRU with per-entry TTL. Values are shared — callers must not mutate them.
 */

interface IGeneration {
  _id: string;
  v: number;
}

const GenerationSchema = new Schema<IGeneration>(
  { _id: { type: String, required: true }, v: { type: Number, required: true, default: 0 } },
  { versionKey: false, collection: "cache_generations" }
);

export const CacheGeneration =
  (mongoose.models.CacheGeneration as mongoose.Model<IGeneration>) ||
  mongoose.model<IGeneration>("CacheGeneration", GenerationSchema);

const GENERATION_MEMO_MS = 1_000;
const MAX_ENTRIES = 2_000;

const entries = new Map<string, { value: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<unknown>>();
const generations = new Map<string, { v: number; fetchedAt: number }>();
export const cacheStats = { hits: 0, misses: 0, loads: 0, invalidations: 0 };

async function generationOf(scope: string): Promise<number> {
  const memo = generations.get(scope);
  if (memo && Date.now() - memo.fetchedAt < GENERATION_MEMO_MS) return memo.v;
  const doc = await CacheGeneration.findById(scope).lean();
  const v = doc?.v ?? 0;
  generations.set(scope, { v, fetchedAt: Date.now() });
  return v;
}

function setEntry(key: string, value: unknown, ttlMs: number) {
  if (entries.size >= MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  entries.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Returns the cached value for (namespace, scope, key) or loads it.
 * @param scope invalidation scope, e.g. `property:<id>`
 */
export async function cached<T>(
  namespace: string,
  scope: string,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  if (process.env.DISABLE_CACHE === "true") return loader();

  const gen = await generationOf(scope);
  const fullKey = `${namespace}|${scope}|g${gen}|${key}`;

  const hit = entries.get(fullKey);
  if (hit && hit.expiresAt > Date.now()) {
    // refresh LRU position
    entries.delete(fullKey);
    entries.set(fullKey, hit);
    cacheStats.hits++;
    return hit.value as T;
  }
  cacheStats.misses++;

  const pending = inflight.get(fullKey);
  if (pending) return pending as Promise<T>;

  const load = (async () => {
    cacheStats.loads++;
    try {
      const value = await loader();
      // Only store if no invalidation happened while loading (otherwise the value may be stale).
      if ((await generationOf(scope)) === gen) setEntry(fullKey, value, ttlMs);
      return value;
    } finally {
      inflight.delete(fullKey);
    }
  })();
  inflight.set(fullKey, load);
  return load;
}

/** Invalidates everything cached for a scope, on every instance. */
export async function invalidate(scope: string): Promise<void> {
  cacheStats.invalidations++;
  const doc = await CacheGeneration.findOneAndUpdate(
    { _id: scope },
    { $inc: { v: 1 } },
    { upsert: true, returnDocument: "after" }
  ).lean();
  generations.set(scope, { v: doc!.v, fetchedAt: Date.now() });
}

export const propertyScope = (propertyId: string | { toString(): string }) => `property:${propertyId.toString()}`;

/** Invalidate all cached aggregates for a property (call after any write to its data). */
export async function invalidateProperty(propertyId: string | { toString(): string } | undefined | null) {
  if (!propertyId) return;
  await invalidate(propertyScope(propertyId));
}

export function __resetCache() {
  entries.clear();
  inflight.clear();
  generations.clear();
  Object.assign(cacheStats, { hits: 0, misses: 0, loads: 0, invalidations: 0 });
}
