import mongoose, { ClientSession } from "mongoose";

let supportCache: { conn: unknown; supported: boolean } | null = null;

/** True when connected to a replica set / sharded cluster (multi-document transactions available). */
export async function transactionsSupported(): Promise<boolean> {
  const conn = mongoose.connection;
  if (supportCache && supportCache.conn === conn.getClient()) return supportCache.supported;
  let supported = false;
  try {
    const hello = await conn.db!.admin().command({ hello: 1 });
    supported = Boolean(hello.setName) || hello.msg === "isdbgrid";
  } catch {
    supported = false;
  }
  supportCache = { conn: conn.getClient(), supported };
  return supported;
}

/**
 * Runs `fn` inside a multi-document transaction when the deployment supports it (Atlas, any
 * replica set); otherwise runs it without a session. Callers on the non-transactional path must
 * keep their own compensation logic.
 *
 * Note: `fn` may be retried by the driver on transient errors, so it must be idempotent.
 */
export async function runInTransaction<T>(fn: (session: ClientSession | undefined) => Promise<T>): Promise<T> {
  if (!(await transactionsSupported())) return fn(undefined);
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
