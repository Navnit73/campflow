import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { beforeAll, afterAll, afterEach } from "vitest";

let server: MongoMemoryServer | null = null;

/** Starts an isolated in-memory MongoDB for the calling test file. */
export function setupTestDatabase() {
  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    process.env.MONGODB_URI = server.getUri();
    const g = global as any;
    g.mongooseCache = { conn: null, promise: null };
    const { connectDB } = await import("@/lib/db/connection");
    await connectDB();
    // Build all declared indexes so unique constraints are enforced in tests.
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });
}
