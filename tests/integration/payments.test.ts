import { describe, it, expect } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { seedTenant, guestInput } from "../helpers/fixtures";
import { ReservationService } from "@/services/reservation.service";
import { PaymentService } from "@/services/payment.service";
import { ReportService } from "@/services/report.service";
import { Payment } from "@/models/Payment";
import { Guest } from "@/models/Guest";

setupTestDatabase();

async function setup() {
  const t = await seedTenant({ taxRatePercent: 0 });
  const r = await ReservationService.createReservation(t.orgId, t.propertyId, {
    siteId: t.site._id.toString(), guest: guestInput(), checkInDate: "2030-06-01", checkOutDate: "2030-06-03",
    adults: 2, children: 0, pets: 0, addOns: [], status: "confirmed", source: "admin", specialRequests: "", notes: "",
  } as any); // total $100
  const pay = (over: Record<string, any>) =>
    PaymentService.recordPayment(t.orgId, t.propertyId, { reservationId: r._id.toString(), amount: 10, type: "payment", method: "cash", status: "completed", transactionReference: "", notes: "", ...over } as any);
  return { t, r, pay };
}

describe("payment ledger (audit H4)", () => {
  it("updates paid/balance atomically and tracks guest spend", async () => {
    const { r, pay } = await setup();
    const res = await pay({ amount: 60 });
    expect(res.reservation.pricing.paidAmount).toBe(60);
    expect(res.reservation.pricing.balanceDue).toBe(40);
    expect((await Guest.findById(r.guestId).lean())!.totalSpent).toBe(60);
  });

  it("idempotency key: a retried request records exactly one payment", async () => {
    const { pay } = await setup();
    const [a, b] = await Promise.all([pay({ amount: 25, idempotencyKey: "key-12345678" }), pay({ amount: 25, idempotencyKey: "key-12345678" })]);
    expect(await Payment.countDocuments()).toBe(1);
    expect(String(a.payment!._id)).toBe(String(b.payment!._id));
    const after = await pay({ amount: 25, idempotencyKey: "key-12345678" });
    expect(after.reservation!.pricing.paidAmount).toBe(25);
  });

  it("concurrent payments are all counted (no lost update)", async () => {
    const { pay } = await setup();
    await Promise.all(Array.from({ length: 10 }, () => pay({ amount: 10 })));
    const { reservation } = await pay({ amount: 0.01 });
    expect(reservation.pricing.paidAmount).toBe(100.01);
    expect(reservation.pricing.balanceDue).toBe(0);
  });

  it("refunds can't exceed net paid, even concurrently", async () => {
    const { pay } = await setup();
    await pay({ amount: 50 });
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => pay({ type: "refund", amount: 20 })));
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(2);
    const { reservation } = await pay({ amount: 0.01 });
    expect(reservation.pricing.paidAmount).toBe(10.01);
  });

  it("pending payments don't move balances or guest spend", async () => {
    const { r, pay } = await setup();
    const res = await pay({ amount: 30, status: "pending" });
    expect(res.reservation.pricing.paidAmount).toBe(0);
    expect((await Guest.findById(r.guestId).lean())!.totalSpent).toBe(0);
  });

  it("rejects new payments on cancelled reservations but allows refunds", async () => {
    const { t, r, pay } = await setup();
    await pay({ amount: 40 });
    await ReservationService.cancelReservation(t.orgId, t.propertyId, r._id.toString());
    await expect(pay({ amount: 10 })).rejects.toMatchObject({ name: "ConflictError" });
    await expect(pay({ type: "refund", amount: 40 })).resolves.toBeTruthy();
  });

  it("uses the property's currency", async () => {
    const { t, pay } = await setup();
    await (await import("@/models/Property")).Property.updateOne({ _id: t.property._id }, { $set: { currency: "CAD" } });
    const res = await pay({ amount: 5 });
    expect(res.payment!.currency).toBe("CAD");
  });
});

describe("financial report (audit H13)", () => {
  it("subtracts refunds from revenue and clamps the period", async () => {
    const { t, pay } = await setup();
    await pay({ amount: 80, method: "cash" });
    await pay({ type: "refund", amount: 30, method: "cash" });
    const rep = await ReportService.getFinancialReports(t.orgId, t.propertyId, 99999);
    expect(rep.periodDays).toBe(366);
    expect(rep.summary.totalRevenue).toBe(50);
    expect(rep.revenueByMethod).toEqual([{ method: "cash", amount: 50 }]);
    expect(rep.dailyRevenueTrend.at(-1)!.amount).toBe(50);
  });
});

describe("occupancy report math", () => {
  it("counts only nights inside the window and groups bookings by site type", async () => {
    const t = await seedTenant({ taxRatePercent: 0 });
    const { zonedDateKey, addDaysStr } = await import("@/lib/utils/date");
    const today = zonedDateKey(new Date(), "America/Denver");
    const book = (siteId: string, from: number, to: number, email: string) =>
      ReservationService.createReservation(t.orgId, t.propertyId, {
        siteId, guest: guestInput(email), checkInDate: addDaysStr(today, from), checkOutDate: addDaysStr(today, to),
        adults: 2, children: 0, pets: 0, addOns: [], status: "confirmed", source: "admin", specialRequests: "", notes: "",
      } as any);
    await book(t.site._id.toString(), -3, -1, "a@x.com"); // 2 nights, inside a 7-day window
    await book(t.site2._id.toString(), -10, -5, "b@x.com"); // nights -10..-6; window is today-6..today → 1 night inside
    await book(t.site._id.toString(), -1, 4, "c@x.com"); // spans today: 2 nights inside (yesterday, today)
    const rep = await ReportService.getFinancialReports(t.orgId, t.propertyId, 7);
    expect(rep.summary.totalNightsBooked).toBe(5); // 2 + 1 + 2
    expect(rep.summary.totalReservations).toBe(3);
    expect(rep.revenueBySiteType).toEqual([{ name: "Full Hookup", count: 3, revenue: 600 }]);
  });
});
