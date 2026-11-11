import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inject } from "vitest";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { Client, day } from "./client";

let mongo: MongoClient;
const owner = new Client();
let siteA = "";
let siteB = "";
let slug = "";

async function staffClient(role: "staff" | "manager", email: string) {
  const me = (await owner.get("/api/auth/me")).json.data;
  await mongo.db().collection("users").insertOne({
    organizationId: new ObjectId(me.user.organizationId),
    name: role,
    email,
    passwordHash: await bcrypt.hash("staff-password-1", 10),
    role,
    isActive: true,
    knownDevices: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const c = new Client();
  expect((await c.post("/api/auth/login", { email, password: "staff-password-1" })).status).toBe(200);
  return c;
}

const newGuest = (n: string) => ({ firstName: "Gina", lastName: `Guest${n}`, email: `gina.${n}@example.com`, phone: "5550101010" });

beforeAll(async () => {
  mongo = await MongoClient.connect(inject("mongoUri"));
  const reg = await owner.post("/api/auth/register", {
    name: "Olivia Owner",
    email: `owner.${Date.now()}@example.com`,
    password: "owner-password-1",
    organizationName: `E2E Park ${Date.now()}`,
    phone: "5551112222",
  });
  expect(reg.status).toBe(201);
  expect(reg.json.data.token).toBeUndefined(); // cookie-only session
  slug = reg.json.data.property.slug;
});
afterAll(async () => mongo?.close());

describe("site setup (owner)", () => {
  it("creates sites and partially updates one without clobbering other fields", async () => {
    const types = (await owner.get("/api/sites/types")).json.data;
    const big = types.find((t: { maxRigLength: number }) => t.maxRigLength >= 40);
    const a = await owner.post("/api/sites", { siteNumber: "A1", siteTypeId: big._id, notes: "near the lake", status: "maintenance" });
    const b = await owner.post("/api/sites", { siteNumber: "B1", siteTypeId: big._id });
    expect([a.status, b.status]).toEqual([201, 201]);
    siteA = a.json.data._id;
    siteB = b.json.data._id;

    const patched = await owner.patch(`/api/sites/${siteA}`, { currentBaseRate: 70 });
    expect(patched.json.data).toMatchObject({ currentBaseRate: 70, status: "maintenance", notes: "near the lake" });
    expect((await owner.patch(`/api/sites/${siteA}`, { status: "available" })).status).toBe(200);
  });
});

describe("guest lifecycle", () => {
  it("creates, partially updates and searches a guest", async () => {
    const g = await owner.post("/api/guests", { ...newGuest("1"), notes: "prefers shade", isVip: true });
    expect(g.status).toBe(201);
    const u = await owner.patch(`/api/guests/${g.json.data._id}`, { phone: "5559999999" });
    expect(u.json.data).toMatchObject({ phone: "5559999999", notes: "prefers shade", isVip: true });
    const s = await owner.get("/api/guests?search=guest1");
    expect(s.json.data.guests).toHaveLength(1);
    expect((await owner.post("/api/guests", newGuest("1"))).status).toBe(409);
  });
});

describe("reservation lifecycle: create → modify → check-in → pay/refund → check-out", () => {
  it("runs the full desk workflow with correct money and status rules", async () => {
    const create = await owner.post("/api/reservations", {
      siteId: siteA, guest: newGuest("2"), checkInDate: day(0), checkOutDate: day(2),
      initialPayment: { amount: 20, method: "cash" },
    });
    expect(create.status).toBe(201);
    const r = create.json.data;
    expect(r.pricing.paidAmount).toBe(20);

    // Double booking the same nights is refused.
    expect((await owner.post("/api/reservations", { siteId: siteA, guest: newGuest("3"), checkInDate: day(1), checkOutDate: day(3) })).status).toBe(409);

    // Modify: extend one night, then move to site B.
    const ext = await owner.patch(`/api/reservations/${r._id}`, { checkOutDate: day(3) });
    expect(ext.json.data.numNights).toBe(3);
    const moved = await owner.patch(`/api/reservations/${r._id}`, { siteId: siteB });
    expect(moved.json.data.siteSnapshot.siteNumber).toBe("B1");

    // Check-out before check-in is refused; check-in works.
    expect((await owner.post(`/api/reservations/${r._id}/check-out`)).status).toBe(409);
    expect((await owner.post(`/api/reservations/${r._id}/check-in`)).json.data.status).toBe("checked_in");

    // Payment with an idempotency key, sent twice → recorded once.
    const key = { "idempotency-key": `e2e-pay-${Date.now()}` };
    await owner.post("/api/payments", { reservationId: r._id, amount: 50, method: "credit_card" }, key);
    const replay = await owner.post("/api/payments", { reservationId: r._id, amount: 50, method: "credit_card" }, key);
    expect(replay.json.data.reservation.pricing.paidAmount).toBe(70);

    // Refunds: partial OK, more than paid refused.
    expect((await owner.post("/api/payments", { reservationId: r._id, amount: 10, type: "refund", method: "cash" })).status).toBe(201);
    expect((await owner.post("/api/payments", { reservationId: r._id, amount: 1000, type: "refund", method: "cash" })).status).toBe(422);

    const out1 = await owner.post(`/api/reservations/${r._id}/check-out`);
    const out2 = await owner.post(`/api/reservations/${r._id}/check-out`);
    expect(out1.json.data.status).toBe("checked_out");
    expect(out2.json.data.checkOutTimeActual).toBe(out1.json.data.checkOutTimeActual); // idempotent
    expect((await owner.post(`/api/reservations/${r._id}/cancel`)).status).toBe(409);

    const detail = await owner.get(`/api/reservations/${r._id}`);
    expect(detail.json.data.payments).toHaveLength(3);
    expect(detail.json.data.pricing.paidAmount).toBe(60);
  });

  it("cancellation frees the site; reactivation is refused once the slot is resold", async () => {
    const a = await owner.post("/api/reservations", { siteId: siteA, guest: newGuest("4"), checkInDate: day(20), checkOutDate: day(22) });
    expect((await owner.post(`/api/reservations/${a.json.data._id}/cancel`, { notes: "plans changed" })).json.data.status).toBe("cancelled");
    expect((await owner.post("/api/reservations", { siteId: siteA, guest: newGuest("5"), checkInDate: day(20), checkOutDate: day(22) })).status).toBe(201);
    expect((await owner.patch(`/api/reservations/${a.json.data._id}`, { status: "confirmed" })).status).toBe(409);
  });
});

describe("concurrency over HTTP", () => {
  it("20 simultaneous bookings for the same site and nights → exactly one succeeds", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        owner.post("/api/reservations", { siteId: siteB, guest: newGuest(`c${i}`), checkInDate: day(40), checkOutDate: day(43) })
      )
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(19);
  });
});

describe("public booking → confirmation → dashboard", () => {
  it("books online at catalog prices and the (cached) dashboard reflects it immediately", async () => {
    await owner.post("/api/addons/seed");
    const before = (await owner.get("/api/dashboard")).json.data.stats;

    const guestBrowser = new Client();
    const avail = await guestBrowser.get(`/api/public/book/availability?slug=${slug}&checkInDate=${day(0)}&checkOutDate=${day(1)}&rigLengthFt=25`);
    expect(avail.status).toBe(200);
    expect(JSON.stringify(avail.json)).not.toContain("organizationId");
    const site = avail.json.data.availableSites[0];
    const addOn = avail.json.data.availableAddOns.find((a: { pricingType: string }) => a.pricingType === "per_unit");

    const book = await guestBrowser.post("/api/public/book/create", {
      slug, siteId: site._id, checkInDate: day(0), checkOutDate: day(1),
      addOns: [{ addOnId: addOn._id, name: addOn.name, price: 0, quantity: 2 }],
      guest: { firstName: "Web", lastName: "Camper", email: `web.${Date.now()}@example.com`, phone: "5552223333", rvLengthFt: 25 },
    });
    expect(book.status).toBe(201);
    expect(book.json.data.reservation.pricing.addOnsSubtotal).toBe(addOn.price * 2);
    expect(book.json.data.reservation.pricing.paidAmount).toBe(0);

    const conf = await guestBrowser.get(`/api/public/book/confirmation/${book.json.data.confirmationCode}?slug=${slug}`);
    expect(conf.json.data.reservation.confirmationCode).toBe(book.json.data.confirmationCode);

    const after = (await owner.get("/api/dashboard")).json.data.stats;
    expect(after.todayArrivalsCount).toBe(before.todayArrivalsCount + 1);
    expect(after.outstandingBalance).toBeGreaterThan(before.outstandingBalance);
  });
});

describe("staff and manager permissions", () => {
  it("staff can run the desk but not refund, change sites, export or broadcast; deactivation takes effect within the session-cache TTL", async () => {
    const staff = await staffClient("staff", `staff.${Date.now()}@example.com`);
    const r = await staff.post("/api/reservations", { siteId: siteA, guest: newGuest("s1"), checkInDate: day(60), checkOutDate: day(61) });
    expect(r.status).toBe(201);
    expect((await staff.post("/api/payments", { reservationId: r.json.data._id, amount: 10, method: "cash" })).status).toBe(201);
    expect((await staff.post("/api/payments", { reservationId: r.json.data._id, amount: 5, type: "refund", method: "cash" })).status).toBe(403);
    expect((await staff.patch(`/api/sites/${siteA}`, { currentBaseRate: 1 })).status).toBe(403);
    expect((await staff.get("/api/reports")).status).toBe(403);
    expect((await staff.post("/api/exports/on-demand", { type: "excel_customers" })).status).toBe(403);
    expect((await staff.post("/api/communications/broadcasts", { subject: "x", message: "y" })).status).toBe(403);

    const me = (await staff.get("/api/auth/me")).json.data;
    await mongo.db().collection("users").updateOne({ _id: new ObjectId(me.user._id) }, { $set: { isActive: false } });
    await new Promise((r) => setTimeout(r, 1_200)); // SESSION_CACHE_TTL_MS=1000 in E2E (30s default)
    expect((await staff.get("/api/dashboard")).status).toBe(401);
  });

  it("managers can refund and manage sites but not export", async () => {
    const mgr = await staffClient("manager", `mgr.${Date.now()}@example.com`);
    expect((await mgr.patch(`/api/sites/${siteB}`, { currentBaseRate: 55 })).status).toBe(200);
    expect((await mgr.get("/api/reports?days=30")).status).toBe(200);
    expect((await mgr.post("/api/exports/on-demand", { type: "excel_customers" })).status).toBe(403);
  });
});

describe("exports, broadcasts and cron (owner)", () => {
  it("generates an export and downloads a valid xlsx", async () => {
    const res = await owner.post("/api/exports/on-demand", { type: "excel_master_accounting", preset: "30d" });
    expect(res.status).toBeLessThan(300);
    const job = res.json?.data?.job ?? res.json?.data;
    const dl = await owner.req("GET", `/api/exports/download/${job._id}`);
    expect(dl.status).toBe(200);
    const bytes = new Uint8Array(await dl.res.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK"); // xlsx = zip
  });

  it("queues a broadcast, delivers it after the response, and dedupes retries", async () => {
    const body = { subject: "Pool hours", message: "Pool closes at 8pm", recipientFilter: "all_guests", idempotencyKey: `e2e-b-${Date.now()}` };
    const first = await owner.post("/api/communications/broadcasts", body);
    expect(first.status).toBe(202);
    expect((await owner.post("/api/communications/broadcasts", body)).status).toBe(200);
    let status = "";
    for (let i = 0; i < 20 && status !== "sent"; i++) {
      await new Promise((r) => setTimeout(r, 250));
      status = (await owner.get("/api/communications/broadcasts")).json.data[0].status;
    }
    expect(status).toBe("sent");
  });

  it("cron requires the secret", async () => {
    const anon = new Client();
    expect((await anon.get("/api/cron/exports")).status).toBe(401);
    const ok = await anon.req("GET", "/api/cron/exports", undefined, { authorization: `Bearer ${inject("cronSecret")}` });
    expect(ok.status).toBe(200);
    expect(ok.json.data.broadcasts).toBeDefined();
  });
});

describe("tenant isolation over HTTP", () => {
  it("another park's owner can't read this park's reservations, guests or exports", async () => {
    const other = new Client();
    await other.post("/api/auth/register", {
      name: "Other", email: `other.${Date.now()}@example.com`, password: "other-password-1",
      organizationName: `Other Park ${Date.now()}`, phone: "5553334444",
    });
    const mine = (await owner.get("/api/reservations")).json.data.reservations[0];
    expect((await other.get(`/api/reservations/${mine._id}`)).status).toBe(404);
    expect((await other.post(`/api/reservations/${mine._id}/cancel`)).status).toBe(404);
    expect((await other.get("/api/reservations")).json.data.reservations).toHaveLength(0);
    expect((await other.patch(`/api/sites/${siteA}`, { currentBaseRate: 1 })).status).toBe(404);
  });
});
