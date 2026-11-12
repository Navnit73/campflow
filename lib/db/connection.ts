import mongoose from "mongoose";
import { redactMongoUri, serverEnv } from "@/lib/env";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  memoryServer?: any;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 10,
    };

    cached.promise = (async () => {
      // Throws a clear, actionable error if MONGODB_URI is missing/invalid (no silent fallback).
      const env = serverEnv();

      if (env.MONGODB_URI) {
        try {
          const m = await mongoose.connect(env.MONGODB_URI, { ...opts, serverSelectionTimeoutMS: 10000 });
          const { host, port, name } = m.connection;
          console.log(`[MongoDB] Connected: ${redactMongoUri(env.MONGODB_URI)} (host ${host}:${port}, db "${name}")`);
          return m;
        } catch (err: unknown) {
          console.error(`[MongoDB] Connection to ${redactMongoUri(env.MONGODB_URI)} failed:`, (err as Error)?.message || err);
          throw err;
        }
      }

      // Explicit opt-in only (automated tests): a throwaway database that is wiped on restart.
      console.warn("[MongoDB] ALLOW_IN_MEMORY_DB=true — using a THROWAWAY in-memory database (all data is lost on restart).");
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      if (!cached.memoryServer) {
        cached.memoryServer = await MongoMemoryServer.create();
      }
      return mongoose.connect(cached.memoryServer.getUri(), opts);
    })();
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
