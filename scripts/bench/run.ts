/**
 * Phase 2/3 benchmark: seeds a deterministic multi-tenant dataset into a real mongod
 * (mongodb-memory-server), then measures every main service path and explains its queries.
 *
 *   npx tsx scripts/bench/run.ts <label> [--size=small|large]
 *
 * Results: docs/audit/perf/<label>.json (+ a markdown table on stdout).
 * Absolute ms are for a local, network-free mongod; plan shapes, docs examined and DB command
 * counts are the portable signals.
 */
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { MongoMemoryServer } from "mongodb-memory-server";
import { seedTenant, SeedSize } from "./seed";

process.env.DISABLE_RATE_LIMIT = "true";
delete process.env.RESEND_API_KEY;

const label = process.argv[2] || "run";
const sizeArg = (process.argv.find((a) => a.startsWith("--size=")) || "--size=large").split("=")[1];
const SIZES: Record<string, SeedSize> = {
  small: { sites: 60, guests: 2_000, reservations: 6_000, paymentsPerReservation: 1 },
  large: { sites: 300, guests: 25_000, reservations: 80_000, paymentsPerReservation: 2 },
};
const size = SIZES[sizeArg] || SIZES.large;
const ITER = Number(process.env.BENCH_ITER) || 25;

let commandCount = 0;

async function measure(name: string, fn: () => Promise<unknown>, iterations = ITER) {
  for (let i = 0; i < 3; i++) await fn(); // warm-up (connection, plan cache)
  const times: number[] = [];
  let commands = 0;
  for (let i = 0; i < iterations; i++) {
    const before = commandCount;
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
    commands += commandCount - before;
  }
  times.sort((a, b) => a - b);
  const q = (p: number) => times[Math.min(times.length - 1, Math.floor(p * times.length))];
  return { name, p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), dbCommandsPerCall: +(commands / iterations).toFixed(1) };
}

type Plan = { stage?: string; inputStage?: Plan; inputStages?: Plan[]; indexName?: string; queryPlan?: Plan };
function stages(plan: Plan | undefined, out: string[] = []): string[] {
  if (!plan) return out;
  const p = plan.queryPlan || plan;
  if (p.stage) out.push(p.indexName ? `${p.stage}(${p.indexName})` : p.stage);
  if (p.inputStage) stages(p.inputStage, out);
  for (const s of p.inputStages || []) stages(s, out);
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarizeExplain(name: string, ex: any) {
  const cursor = ex?.stages?.[0]?.$cursor || ex;
  const es = cursor.executionStats || ex.executionStats || {};
  const plan = cursor.queryPlanner?.winningPlan;
  return {
    name,
    plan: stages(plan).join(" ← "),
    keysExamined: es.totalKeysExamined,
    docsExamined: es.totalDocsExamined,
    nReturned: es.nReturned,
    ms: es.executionTimeMillis,
  };
}

async function main() {
  const server = await MongoMemoryServer.create();
  const uri = server.getUri("bench");
  const conn = await mongoose.connect(uri, { maxPoolSize: 10, monitorCommands: true });
  conn.connection.getClient().on("commandStarted", () => commandCount++);
  (global as unknown as { mongooseCache: unknown }).mongooseCache = { conn, promise: Promise.resolve(conn) };
  process.env.MONGODB_URI = uri;

  // Load every model, then build indexes BEFORE seeding (as in production).
  const { Reservation } = await import("@/models/Reservation");
  const { Payment } = await import("@/models/Payment");
  const { Guest } = await import("@/models/Guest");
  const { Site } = await import("@/models/Site");
  await import("@/models/Discount");
  await import("@/models/ExportJob");
  await import("@/models/ExportSchedule");
  await import("@/models/Broadcast");
  await import("@/models/AuditLog");
  await import("@/lib/booking/site-lock");
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));

  const t0 = performance.now();
  const tenant = await seedTenant(size, 42, "alpha");
  await seedTenant({ ...size, reservations: Math.floor(size.reservations / 4), guests: Math.floor(size.guests / 4) }, 7, "beta");
  console.error(`Seeded in ${((performance.now() - t0) / 1000).toFixed(1)}s:`, size);

  const { ReservationService } = await import("@/services/reservation.service");
  const { PaymentService } = await import("@/services/payment.service");
  const { GuestService } = await import("@/services/guest.service");
  const { SiteService } = await import("@/services/site.service");
  const { DashboardService } = await import("@/services/dashboard.service");
  const { ReportService } = await import("@/services/report.service");
  const { PublicBookingService } = await import("@/services/public-booking.service");
  const { CommunicationService } = await import("@/services/communication.service");
  const { ExportService } = await import("@/services/export.service");
  const { zonedDateKey, addDaysStr } = await import("@/lib/utils/date");

  const { orgId, propertyId } = tenant;
  const today = zonedDateKey(new Date(), "America/Denver");
  const q = (o: Record<string, unknown>) => ({ page: 1, limit: 20, ...o }) as never;

  const results = [];
  results.push(await measure("reservations.list (page 1)", () => ReservationService.listReservations(orgId, propertyId, q({}))));
  results.push(await measure("reservations.list (page 200)", () => ReservationService.listReservations(orgId, propertyId, q({ page: 200 }))));
  results.push(await measure("reservations.list (search 'smith')", () => ReservationService.listReservations(orgId, propertyId, q({ search: "smith" }))));
  results.push(await measure("reservations.list (search, no match — worst case)", () => ReservationService.listReservations(orgId, propertyId, q({ search: "zzqxj" }))));
  // Seeded codes contain 0/1 (never generated in production), so book one real reservation for this probe.
  const realCode = (
    await ReservationService.createReservation(orgId, propertyId, {
      siteId: tenant.siteIds[1], guest: { firstName: "Code", lastName: "Probe", email: "code.probe@x.com", phone: "5550001111", rvType: "travel_trailer", rvLengthFt: 25, licensePlate: "" },
      checkInDate: addDaysStr(today, 3000), checkOutDate: addDaysStr(today, 3002), adults: 2, children: 0, pets: 0, addOns: [], status: "confirmed", source: "admin", specialRequests: "", notes: "",
    } as never)
  ).confirmationCode;
  results.push(await measure("reservations.list (search by code prefix)", () => ReservationService.listReservations(orgId, propertyId, q({ search: realCode.slice(0, 7) }))));
  results.push(await measure("reservations.list (status+30d range)", () => ReservationService.listReservations(orgId, propertyId, q({ status: "confirmed", startDate: today, endDate: addDaysStr(today, 30) }))));
  results.push(await measure("reservations.get (detail)", () => ReservationService.getReservationById(orgId, propertyId, tenant.sampleReservationId)));
  results.push(await measure("tape-chart (14 days)", () => ReservationService.getTapeChartData(orgId, propertyId, today, 14)));
  results.push(await measure("tape-chart (60 days)", () => ReservationService.getTapeChartData(orgId, propertyId, today, 60)));
  results.push(await measure("availability (all sites, 3 nights)", () => ReservationService.checkAllSitesAvailability(orgId, propertyId, addDaysStr(today, 10), addDaysStr(today, 13))));
  // "dashboard summary" / "reports" = uncached computation (comparable with earlier runs).
  results.push(await measure("dashboard summary", () => DashboardService.computeDashboardSummary(orgId, propertyId)));
  results.push(await measure("reports (30 days)", () => ReportService.computeFinancialReports(orgId, propertyId, 30)));
  results.push(await measure("reports (365 days)", () => ReportService.computeFinancialReports(orgId, propertyId, 365), 10));
  // Phase 4: same calls through the cache (repeat reads → hits).
  results.push(await measure("dashboard summary (cached)", () => DashboardService.getDashboardSummary(orgId, propertyId)));
  results.push(await measure("reports 365d (cached)", () => ReportService.getFinancialReports(orgId, propertyId, 365)));
  // Worst case: a write before every read invalidates, so each read recomputes.
  results.push(
    await measure("dashboard after a write (invalidated)", async () => {
      await PaymentService.recordPayment(orgId, propertyId, { reservationId: tenant.sampleReservationId, amount: 1, type: "payment", method: "cash", status: "completed", transactionReference: "", notes: "" } as never);
      return DashboardService.getDashboardSummary(orgId, propertyId);
    })
  );
  results.push(await measure("guests.list (page 1)", () => GuestService.listGuests(orgId, propertyId, q({}))));
  results.push(await measure("guests.list (search 'garcia')", () => GuestService.listGuests(orgId, propertyId, q({ search: "garcia" }))));
  results.push(await measure("guests.get (300-stay history)", () => GuestService.getGuestById(orgId, propertyId, tenant.sampleGuestId)));
  results.push(await measure("payments.list (page 1)", () => PaymentService.listPayments(orgId, propertyId, q({}))));
  results.push(await measure("sites.list", () => SiteService.listSites(orgId, propertyId)));
  results.push(await measure("public.search availability", () => PublicBookingService.searchAvailableSites({ slug: tenant.slug, checkInDate: addDaysStr(today, 20), checkOutDate: addDaysStr(today, 23), rigLengthFt: 30 } as never)));
  results.push(await measure("public.confirmation lookup", () => PublicBookingService.getBookingConfirmation(tenant.sampleConfirmationCode, tenant.slug)));
  results.push(await measure("broadcast audience (all guests)", () => CommunicationService.resolveAudience(propertyId, "all_guests"), 10));

  // Writes: each iteration books a distinct far-future slot so there are no conflicts.
  let w = 0;
  results.push(
    await measure("reservations.create (+initial payment)", () => {
      const i = w++;
      const siteId = tenant.siteIds[i % tenant.siteIds.length];
      const start = addDaysStr(today, 900 + Math.floor(i / tenant.siteIds.length) * 5);
      return ReservationService.createReservation(orgId, propertyId, {
        siteId, guest: { firstName: "Bench", lastName: "User", email: `bench${i}@x.com`, phone: "5550001111", rvType: "travel_trailer", rvLengthFt: 25, licensePlate: "" },
        checkInDate: start, checkOutDate: addDaysStr(start, 2), adults: 2, children: 0, pets: 0, addOns: [], status: "confirmed", source: "admin",
        specialRequests: "", notes: "", initialPayment: { amount: 10, method: "cash" },
      } as never);
    })
  );
  results.push(
    await measure("payments.record", () =>
      PaymentService.recordPayment(orgId, propertyId, { reservationId: tenant.sampleReservationId, amount: 1, type: "payment", method: "cash", status: "completed", transactionReference: "", notes: "" } as never)
    )
  );
  results.push(await measure("export (master, last 30d)", () => ExportService.generateOnDemandExport(orgId, propertyId, undefined, { type: "excel_master_accounting", preset: "30d" } as never), 5));

  // ---- explain plans for the main query of each path ----
  const P = new mongoose.Types.ObjectId(propertyId);
  const O = new mongoose.Types.ObjectId(orgId);
  const todayD = new Date(`${today}T00:00:00Z`);
  const in14 = new Date(todayD.getTime() + 14 * 86_400_000);
  const explains: ReturnType<typeof summarizeExplain>[] = [];
  const ex = async (name: string, query: { explain: (v: string) => Promise<unknown> }) => explains.push(summarizeExplain(name, await query.explain("executionStats")));

  await ex("reservations.list page1", Reservation.find({ organizationId: O, propertyId: P }).sort({ checkInDate: -1, createdAt: -1 }).limit(20));
  await ex("reservations.list search", Reservation.find({ organizationId: O, propertyId: P, $or: [{ confirmationCode: /smith/i }, { "guestSnapshot.fullName": /smith/i }, { "guestSnapshot.email": /smith/i }, { "guestSnapshot.phone": /smith/i }, { "siteSnapshot.siteNumber": /smith/i }] }).sort({ checkInDate: -1, createdAt: -1 }).limit(20));
  await ex("search tokens: rare term (no match)", Reservation.find({ propertyId: P, searchTokens: { $regex: "^zzqxj" } }).sort({ checkInDate: -1, createdAt: -1 }).limit(20));
  await ex("search tokens: common term 'smith'", Reservation.find({ organizationId: O, propertyId: P, searchTokens: { $regex: "^smith" } }).sort({ checkInDate: -1, createdAt: -1 }).limit(20));
  await ex("search legacy check (searchTokens: null)", Reservation.find({ propertyId: P, searchTokens: null }).limit(1));
  await ex("reservations.count (list total)", Reservation.aggregate([{ $match: { organizationId: O, propertyId: P } }, { $count: "n" }]) as never);
  await ex("tape-chart reservations", Reservation.find({ propertyId: P, status: { $in: ["confirmed", "checked_in", "pending", "checked_out"] }, checkInDate: { $lt: in14 }, checkOutDate: { $gt: todayD } }));
  await ex("availability overlap (all sites)", Reservation.find({ propertyId: P, status: { $in: ["pending", "confirmed", "checked_in"] }, checkInDate: { $lt: in14 }, checkOutDate: { $gt: todayD } }));
  await ex("availability overlap (one site)", Reservation.find({ propertyId: P, siteId: new mongoose.Types.ObjectId(tenant.siteIds[0]), status: { $in: ["pending", "confirmed", "checked_in"] }, checkInDate: { $lt: in14 }, checkOutDate: { $gt: todayD } }).limit(1));
  await ex("dashboard arrivals", Reservation.find({ propertyId: P, status: { $in: ["confirmed", "pending"] }, checkInDate: { $gte: todayD, $lt: new Date(todayD.getTime() + 86_400_000) } }));
  await ex("dashboard departures", Reservation.find({ propertyId: P, status: "checked_in", checkOutDate: { $gte: todayD, $lt: new Date(todayD.getTime() + 86_400_000) } }));
  await ex("dashboard upcoming", Reservation.find({ propertyId: P, status: { $in: ["confirmed", "pending"] }, checkInDate: { $gte: new Date(todayD.getTime() + 86_400_000), $lte: new Date(todayD.getTime() + 7 * 86_400_000) } }).sort({ checkInDate: 1 }).limit(8));
  await ex("dashboard on-site", Reservation.find({ propertyId: P, status: "checked_in" }).sort({ checkOutDate: 1 }));
  await ex("dashboard recent", Reservation.find({ propertyId: P }).sort({ createdAt: -1 }).limit(6));
  await ex("dashboard outstanding (agg)", Reservation.aggregate([{ $match: { propertyId: P, status: { $in: ["confirmed", "checked_in", "pending"] } } }, { $group: { _id: null, t: { $sum: "$pricing.balanceDue" } } }]) as never);
  await ex("reports stays overlap (365d)", Reservation.find({ propertyId: P, status: { $in: ["confirmed", "checked_in", "checked_out"] }, checkInDate: { $lt: todayD }, checkOutDate: { $gt: new Date(todayD.getTime() - 365 * 86_400_000) } }).select("checkInDate checkOutDate"));
  await ex("payments.list page1", Payment.find({ organizationId: O, propertyId: P }).sort({ createdAt: -1 }).limit(20));
  await ex("payments by reservation", Payment.find({ reservationId: new mongoose.Types.ObjectId(tenant.sampleReservationId), propertyId: P }).sort({ createdAt: -1 }));
  await ex("guests.list page1", Guest.find({ organizationId: O, propertyId: P }).sort({ updatedAt: -1 }).limit(20));
  await ex("guest history", Reservation.find({ guestId: new mongoose.Types.ObjectId(tenant.sampleGuestId), propertyId: P }).sort({ checkInDate: -1 }).limit(200));
  await ex("guest by email (booking upsert)", Guest.find({ organizationId: O, email: "james.smith.1@alpha.example.com" }));
  await ex("confirmation lookup", Reservation.find({ confirmationCode: tenant.sampleConfirmationCode, propertyId: P }));
  await ex("sites.list", Site.find({ organizationId: O, propertyId: P }).sort({ sortOrder: 1, siteNumber: 1 }));
  await ex("export guests (sorted)", Guest.find({ propertyId: P }).sort({ createdAt: -1 }));
  await ex("export reservations 30d ($or)", Reservation.find({ propertyId: P, $or: [{ createdAt: { $gte: new Date(Date.now() - 30 * 86_400_000) } }, { checkInDate: { $gte: new Date(todayD.getTime() - 30 * 86_400_000), $lte: todayD } }] }));

  const out = { label, size, iterations: ITER, mongod: (await conn.connection.db!.admin().serverInfo()).version, generatedAt: new Date().toISOString(), results, explains };
  const dir = path.join(process.cwd(), "docs/audit/perf");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${label}.json`), JSON.stringify(out, null, 2));

  console.log(`\n## ${label} — latency (p50/p95 ms) and DB commands per call\n`);
  console.log("| Path | p50 | p95 | DB cmds |\n|---|---:|---:|---:|");
  for (const r of results) console.log(`| ${r.name} | ${r.p50} | ${r.p95} | ${r.dbCommandsPerCall} |`);
  console.log(`\n## ${label} — explain\n`);
  console.log("| Query | Plan | keys | docs | returned | ms |\n|---|---|---:|---:|---:|---:|");
  for (const e of explains) console.log(`| ${e.name} | ${e.plan} | ${e.keysExamined} | ${e.docsExamined} | ${e.nReturned} | ${e.ms} |`);

  await mongoose.disconnect();
  await server.stop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
