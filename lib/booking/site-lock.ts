import mongoose, { Schema } from "mongoose";
import { randomUUID } from "node:crypto";
import { ConflictError } from "@/lib/utils/errors";

/**
 * Per-site booking lease lock.
 *
 * Availability is "check overlap, then insert". Without serialization two concurrent
 * requests can both pass the check and double-book a site. This lock makes the
 * check+write critical section mutually exclusive per site using a single-document
 * atomic upsert, so it works on standalone MongoDB and replica sets alike (no
 * multi-document transactions required).
 *
 * Acquire: upsert {_id: siteId} only if the lease is free/expired. If another holder
 * owns a live lease, the filter misses and the upsert collides on _id (E11000) → retry.
 * A crashed holder's lease self-expires after LEASE_MS.
 */

interface ISiteLock {
  _id: mongoose.Types.ObjectId;
  owner: string;
  lockedUntil: Date;
}

const SiteLockSchema = new Schema<ISiteLock>(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    owner: { type: String, required: true },
    lockedUntil: { type: Date, required: true },
  },
  { versionKey: false, collection: "site_booking_locks" }
);

export const SiteLock =
  (mongoose.models.SiteLock as mongoose.Model<ISiteLock>) ||
  mongoose.model<ISiteLock>("SiteLock", SiteLockSchema);

const LEASE_MS = 15_000;
const MAX_WAIT_MS = 8_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tryAcquire(siteId: mongoose.Types.ObjectId, owner: string): Promise<boolean> {
  const now = new Date();
  try {
    await SiteLock.findOneAndUpdate(
      { _id: siteId, lockedUntil: { $lte: now } },
      { $set: { owner, lockedUntil: new Date(now.getTime() + LEASE_MS) } },
      { upsert: true }
    );
    return true;
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 11000) return false; // live lease held by someone else
    throw err;
  }
}

async function release(siteId: mongoose.Types.ObjectId, owner: string) {
  await SiteLock.updateOne({ _id: siteId, owner }, { $set: { lockedUntil: new Date(0) } }).catch(() => {});
}

/** Runs `fn` while holding the booking lock for `siteId`. */
export async function withSiteLock<T>(
  siteId: string | mongoose.Types.ObjectId,
  fn: () => Promise<T>
): Promise<T> {
  const id = new mongoose.Types.ObjectId(siteId);
  const owner = randomUUID();
  const deadline = Date.now() + MAX_WAIT_MS;
  let delay = 10;

  while (!(await tryAcquire(id, owner))) {
    if (Date.now() > deadline) {
      throw new ConflictError("This site is being booked by another request. Please try again.");
    }
    await sleep(delay + Math.random() * delay);
    delay = Math.min(delay * 2, 200);
  }

  try {
    return await fn();
  } finally {
    await release(id, owner);
  }
}
