/**
 * Local MongoDB for development — persistent, no install needed.
 *
 *   npm run db:local          # starts mongod on 127.0.0.1:27017, data in ./.data/mongo
 *
 * Uses the real `mongod` binary that mongodb-memory-server already downloads (cached in
 * ~/.cache/mongodb-binaries), runs it as a single-node replica set "rs0" so multi-document
 * transactions work exactly like Atlas, and keeps data between restarts. Ctrl+C stops it.
 * Matches MONGODB_URI in .env.development.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";
import { MongoBinary } from "mongodb-memory-server";

const PORT = Number(process.env.LOCAL_DB_PORT) || 27017;
const DB_PATH = path.resolve(process.env.LOCAL_DB_PATH || ".data/mongo");
const REPL_SET = "rs0";

async function main() {
  fs.mkdirSync(DB_PATH, { recursive: true });
  const binary = await MongoBinary.getPath();
  console.log(`[db:local] mongod: ${binary}`);
  console.log(`[db:local] data:   ${DB_PATH}`);

  const mongod = spawn(binary, ["--dbpath", DB_PATH, "--port", String(PORT), "--bind_ip", "127.0.0.1", "--replSet", REPL_SET], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  mongod.on("exit", (code) => {
    console.log(`[db:local] mongod exited (${code})`);
    process.exit(code ?? 0);
  });
  const stop = () => mongod.kill("SIGINT");
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  // Wait for mongod, then initiate the replica set once (persisted in the data dir afterwards).
  const client = new MongoClient(`mongodb://127.0.0.1:${PORT}/?directConnection=true`, { serverSelectionTimeoutMS: 1000 });
  for (let i = 0; ; i++) {
    try {
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      break;
    } catch (err) {
      if (i > 60) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  try {
    await client.db("admin").command({ replSetGetStatus: 1 });
  } catch (err: unknown) {
    if ((err as { codeName?: string }).codeName !== "NotYetInitialized") throw err;
    await client.db("admin").command({ replSetInitiate: { _id: REPL_SET, members: [{ _id: 0, host: `127.0.0.1:${PORT}` }] } });
    console.log("[db:local] replica set initiated");
  }
  for (let i = 0; i < 60; i++) {
    const hello = await client.db("admin").command({ hello: 1 });
    if (hello.isWritablePrimary) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await client.close();
  console.log(`[db:local] ready → mongodb://127.0.0.1:${PORT}/campflow_local?replicaSet=${REPL_SET}  (Ctrl+C to stop)`);
}

main().catch((err) => {
  console.error("[db:local] failed:", err);
  process.exit(1);
});
