/**
 * Phase 7 load test: real `next start` production server + replica-set MongoDB seeded with the
 * "large" benchmark dataset, driven by autocannon. Requires `npm run build` first.
 *
 *   npx tsx scripts/load/run.ts [--duration=10] [--connections=50]
 *
 * Reports throughput, latency percentiles, errors, server RSS/CPU and MongoDB connection count.
 * Results: docs/audit/perf/load.json
 */
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import autocannon from "autocannon";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { seedTenant } from "../bench/seed";

const arg = (name: string, def: number) => Number((process.argv.find((a) => a.startsWith(`--${name}=`)) || "").split("=")[1]) || def;
const DURATION = arg("duration", 10);
const CONNECTIONS = arg("connections", 50);
const ROUNDS = arg("rounds", 1); // >1 = soak: repeat all scenarios to check memory plateaus
const PORT = 3088;
const BASE = `http://localhost:${PORT}`;

function serverPid(): number | null {
  try {
    return Number(execSync(`lsof -ti tcp:${PORT} -sTCP:LISTEN`).toString().trim().split("\n")[0]) || null;
  } catch {
    return null;
  }
}

function sampleProcess(pid: number) {
  const samples: { rssMb: number; cpu: number }[] = [];
  const timer = setInterval(() => {
    try {
      const [rss, cpu] = execSync(`ps -o rss=,%cpu= -p ${pid}`).toString().trim().split(/\s+/).map(Number);
      samples.push({ rssMb: Math.round(rss / 1024), cpu });
    } catch {
      /* process gone */
    }
  }, 500);
  return () => {
    clearInterval(timer);
    const peakRss = Math.max(...samples.map((s) => s.rssMb));
    const avgCpu = samples.reduce((a, s) => a + s.cpu, 0) / Math.max(1, samples.length);
    return { peakRssMb: peakRss, avgCpuPct: Math.round(avgCpu) };
  };
}

async function main() {
  if (!fs.existsSync(".next/BUILD_ID")) throw new Error("Run `npm run build` first.");
  const rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const uri = rs.getUri("load");
  await mongoose.connect(uri);
  for (const m of ["AddOn", "AuditLog", "Broadcast", "Discount", "ExportJob", "ExportSchedule", "Guest", "Organization", "Payment", "Property", "Reservation", "Site", "SiteType", "User"]) {
    await import(`@/models/${m}`);
  }
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  const tenant = await seedTenant({ sites: 300, guests: 25_000, reservations: 80_000, paymentsPerReservation: 2 }, 42, "alpha");
  await mongoose.connection.db!.collection("users").updateOne(
    { email: "alpha-owner@example.com" },
    { $set: { passwordHash: await bcrypt.hash("load-password-1", 10) } }
  );
  console.error("seeded");

  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    env: { ...process.env, NODE_ENV: "production", MONGODB_URI: uri, JWT_SECRET: "load_test_jwt_secret_long_enough_123456", DISABLE_RATE_LIMIT: "true", RESEND_API_KEY: "", NEXT_PUBLIC_APP_URL: BASE },
    stdio: "ignore",
  });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${BASE}/login`)).ok) break;
    } catch {
      /* booting */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const pid = serverPid();
  if (!pid) throw new Error("server pid not found");

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "alpha-owner@example.com", password: "load-password-1" }),
  });
  const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie.startsWith("rv_session_token=")) throw new Error("login failed");
  const headers = { cookie, "content-type": "application/json" };

  const today = new Date().toISOString().slice(0, 10);
  const plus = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
  const conns = async () => ((await mongoose.connection.db!.admin().command({ serverStatus: 1 })).connections.current as number);

  const scenarios: { name: string; opts: autocannon.Options }[] = [
    { name: "GET /api/dashboard (cached)", opts: { url: `${BASE}/api/dashboard`, headers } },
    { name: "GET /api/reservations (page 1)", opts: { url: `${BASE}/api/reservations?page=1&limit=20`, headers } },
    { name: "GET /api/reservations/tape-chart (14d)", opts: { url: `${BASE}/api/reservations/tape-chart?startDate=${today}&days=14`, headers } },
    { name: "GET /api/reports?days=365 (cached)", opts: { url: `${BASE}/api/reports?days=365`, headers } },
    { name: "GET public availability", opts: { url: `${BASE}/api/public/book/availability?slug=${tenant.slug}&checkInDate=${plus(20)}&checkOutDate=${plus(23)}&rigLengthFt=30` } },
    {
      name: "POST /api/reservations (unique slots, write throughput)",
      opts: (() => {
        let i = 0;
        return {
          url: `${BASE}/api/reservations`,
          method: "POST",
          headers,
          requests: [
            {
              setupRequest: (req: autocannon.Request) => {
                const n = i++;
                const site = tenant.siteIds[n % tenant.siteIds.length];
                const start = plus(1200 + Math.floor(n / tenant.siteIds.length) * 4);
                return {
                  ...req,
                  body: JSON.stringify({
                    siteId: site,
                    guest: { firstName: "Load", lastName: "Test", email: `load${n}@x.com`, phone: "5550001111" },
                    checkInDate: start,
                    checkOutDate: plus(1200 + Math.floor(n / tenant.siteIds.length) * 4 + 2),
                  }),
                };
              },
            },
          ],
        } as autocannon.Options;
      })(),
    },
  ];

  const tapeRes = await fetch(`${BASE}/api/reservations/tape-chart?startDate=${today}&days=14`, { headers });
  const tapeBytes = (await tapeRes.arrayBuffer()).byteLength;
  const dashBytes = (await (await fetch(`${BASE}/api/dashboard`, { headers })).arrayBuffer()).byteLength;
  console.error(`payload: tape-chart ${Math.round(tapeBytes / 1024)} KB, dashboard ${Math.round(dashBytes / 1024)} KB`);

  const results = [];
  const connsBefore = await conns();
  const soak: { round: number; rssMbAfter: number }[] = [];
  for (let round = 1; round <= ROUNDS; round++) {
  for (const s of scenarios) {
    const stop = sampleProcess(pid);
    const r = await autocannon({ ...s.opts, connections: CONNECTIONS, duration: DURATION });
    const proc = stop();
    results.push({
      name: s.name,
      reqPerSec: Math.round(r.requests.average),
      latencyP50: r.latency.p50,
      latencyP97_5: r.latency.p97_5,
      latencyP99: r.latency.p99,
      total: r.requests.total,
      non2xx: r.non2xx,
      errors: r.errors + r.timeouts,
      ...proc,
      mongoConnections: await conns(),
    });
    console.error(`done: ${s.name}`);
  }
    const rss = Number(execSync(`ps -o rss= -p ${pid}`).toString().trim()) / 1024;
    soak.push({ round, rssMbAfter: Math.round(rss) });
    if (ROUNDS > 1) console.error(`round ${round}: RSS ${Math.round(rss)} MB`);
  }

  // Burst: 100 simultaneous bookings for the same site and nights.
  const burst = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      fetch(`${BASE}/api/reservations`, {
        method: "POST",
        headers,
        body: JSON.stringify({ siteId: tenant.siteIds[0], guest: { firstName: "Burst", lastName: "X", email: `burst${i}@x.com`, phone: "5550002222" }, checkInDate: plus(2000), checkOutDate: plus(2003) }),
      }).then((r) => r.status)
    )
  );
  const burstSummary = burst.reduce<Record<string, number>>((acc, s) => ((acc[s] = (acc[s] || 0) + 1), acc), {});
  const booked = await mongoose.connection.db!.collection("reservations").countDocuments({
    siteId: new mongoose.Types.ObjectId(tenant.siteIds[0]),
    checkInDate: new Date(`${plus(2000)}T00:00:00Z`),
  });

  const out = { durationSec: DURATION, connections: CONNECTIONS, rounds: ROUNDS, soak, payloadKb: { tapeChart: Math.round(tapeBytes / 1024), dashboard: Math.round(dashBytes / 1024) }, connsBefore, results, burst: { statuses: burstSummary, reservationsCreated: booked }, at: new Date().toISOString() };
  const dir = path.join(process.cwd(), "docs/audit/perf");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, ROUNDS > 1 ? "load-soak.json" : "load.json"), JSON.stringify(out, null, 2));

  console.log(`\n## Load test — ${CONNECTIONS} connections × ${DURATION}s per scenario (MongoDB connections before load: ${connsBefore})\n`);
  console.log("| Scenario | req/s | p50 ms | p97.5 ms | p99 ms | requests | non-2xx | errors | peak RSS MB | avg CPU % | Mongo conns |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const r of results) console.log(`| ${r.name} | ${r.reqPerSec} | ${r.latencyP50} | ${r.latencyP97_5} | ${r.latencyP99} | ${r.total} | ${r.non2xx} | ${r.errors} | ${r.peakRssMb} | ${r.avgCpuPct} | ${r.mongoConnections} |`);
  if (ROUNDS > 1) console.log(`\nSoak (RSS after each full round): ${soak.map((x) => `${x.rssMbAfter} MB`).join(" → ")}`);
  console.log(`\nBurst of 100 identical bookings: ${JSON.stringify(burstSummary)} → reservations in DB for that slot: ${booked}`);

  server.kill("SIGTERM");
  try { process.kill(pid, "SIGTERM"); } catch { /* already gone */ }
  await mongoose.disconnect();
  await rs.stop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
