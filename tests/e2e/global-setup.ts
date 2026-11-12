import { spawn, ChildProcess } from "node:child_process";
import fs from "node:fs";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string;
    mongoUri: string;
    cronSecret: string;
  }
}

const PORT = Number(process.env.E2E_PORT) || 3077;
const CRON_SECRET = "e2e_cron_secret_value_1234";

export default async function setup(project: TestProject) {
  if (!fs.existsSync(".next/BUILD_ID")) throw new Error("No production build found. Run `npm run build` first.");

  // Replica set so the transactional booking path is what E2E exercises.
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const mongoUri = mongo.getUri("e2e");

  const server: ChildProcess = spawn("npx", ["next", "start", "-p", String(PORT)], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      MONGODB_URI: mongoUri,
      JWT_SECRET: "e2e_jwt_secret_that_is_definitely_long_enough",
      CRON_SECRET,
      DISABLE_RATE_LIMIT: "true",
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      SESSION_CACHE_TTL_MS: "1000",
      RESEND_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  server.stdout?.on("data", (d) => (log += d));
  server.stderr?.on("data", (d) => (log += d));

  const baseUrl = `http://localhost:${PORT}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      const res = await fetch(`${baseUrl}/login`);
      if (res.ok) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`next start did not come up:\n${log.slice(-2000)}`);
    await new Promise((r) => setTimeout(r, 300));
  }

  project.provide("baseUrl", baseUrl);
  project.provide("mongoUri", mongoUri);
  project.provide("cronSecret", CRON_SECRET);

  return async () => {
    server.kill("SIGTERM");
    await mongo.stop();
  };
}
