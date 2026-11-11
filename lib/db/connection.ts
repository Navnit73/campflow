import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  memoryServer?: any;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

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

    let uri = process.env.MONGODB_URI;

    cached.promise = (async () => {
      // 1. If MONGODB_URI is provided, connect directly to it
      if (uri) {
        try {
          console.log("[MongoDB] Connecting to database URI...");
          const m = await mongoose.connect(uri, { ...opts, serverSelectionTimeoutMS: 10000 });
          console.log("[MongoDB] Connected successfully to MongoDB!");
          return m;
        } catch (err: any) {
          console.error("[MongoDB] Connection to MONGODB_URI failed:", err?.message || err);
          throw err;
        }
      }

      // 2. Only in local development/test (or with explicit opt-in) fall back to an in-memory MongoDB.
      // A misconfigured staging server must fail loudly rather than silently run on throwaway data.
      const allowInMemory =
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test" ||
        process.env.ALLOW_IN_MEMORY_DB === "true";
      if (allowInMemory) {
        try {
          console.log("[MongoDB] MONGODB_URI not found. Initializing MongoMemoryServer for development...");
          const { MongoMemoryServer } = await import("mongodb-memory-server");
          if (!cached.memoryServer) {
            cached.memoryServer = await MongoMemoryServer.create();
          }
          const memUri = cached.memoryServer.getUri();
          console.log("[MongoDB] Connected to in-memory database instance:", memUri);
          const m = await mongoose.connect(memUri, opts);
          return m;
        } catch (memErr) {
          console.error("[MongoDB] Failed to start MongoMemoryServer fallback:", memErr);
          throw memErr;
        }
      }

      throw new Error("MONGODB_URI is not defined (set ALLOW_IN_MEMORY_DB=true to use a throwaway in-memory database).");
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
