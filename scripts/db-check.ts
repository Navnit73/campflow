/**
 * Prints which database this checkout is configured to use and whether it's reachable.
 *   npm run db:check                 # resolves env exactly like `next dev`
 *   NODE_ENV=production npm run db:check   # like `next start`
 */
import { loadEnvConfig } from "@next/env";

const dev = process.env.NODE_ENV !== "production";
const { loadedEnvFiles } = loadEnvConfig(process.cwd(), dev);

(async () => {
  const { redactMongoUri, serverEnv } = await import("@/lib/env");
  console.log(`Mode:        ${dev ? "development (next dev)" : "production (next start)"}`);
  console.log(`Env files:   ${loadedEnvFiles.map((f) => f.path).join(", ") || "(none)"}`);
  let env;
  try {
    env = serverEnv();
  } catch (e) {
    console.log(`\n✗ ${(e as Error).message}`);
    process.exit(1);
  }
  if (!env.MONGODB_URI) {
    console.log("Database:    THROWAWAY in-memory (ALLOW_IN_MEMORY_DB=true) — data is lost on restart");
    process.exit(0);
  }
  console.log(`Database:    ${redactMongoUri(env.MONGODB_URI)}`);
  const mongoose = (await import("mongoose")).default;
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
    const db = mongoose.connection.db!;
    const hello = await db.admin().command({ hello: 1 });
    const collections = await db.listCollections().toArray();
    const counts: string[] = [];
    for (const name of ["organizations", "properties", "reservations", "guests"]) {
      if (collections.some((c) => c.name === name)) counts.push(`${name}=${await db.collection(name).estimatedDocumentCount()}`);
    }
    console.log(`Reachable:   yes (db "${db.databaseName}", ${hello.setName ? `replica set "${hello.setName}" → transactions ON` : "standalone → transactions OFF, compensation fallback"})`);
    console.log(`Data:        ${counts.join(", ") || "empty"}`);
    await mongoose.disconnect();
  } catch (e) {
    console.log(`Reachable:   NO — ${(e as Error).message}`);
    if (env.MONGODB_URI.includes("127.0.0.1")) console.log("             Start the local database with: npm run db:local");
    process.exit(1);
  }
})();
