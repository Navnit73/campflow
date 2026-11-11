import { describe, it, expect } from "vitest";
import { calculatePricing } from "@/lib/utils/pricing";
import { diffDays, isDateOverlap, parseDateOnly, zonedDateKey, zonedMidnight } from "@/lib/utils/date";
import { canTransition, isBlocking } from "@/lib/booking/status";
import { escapeRegex } from "@/lib/utils/regex";
import { generateConfirmationCode } from "@/lib/utils/code-generator";
import { toDotPaths } from "@/lib/utils/flatten";

describe("calculatePricing", () => {
  const base = { nightlyRate: 50, checkInDate: "2026-06-01", checkOutDate: "2026-06-04", taxRatePercent: 10 };

  it("per-stay non-taxable add-on", () => {
    const r = calculatePricing({ ...base, addOns: [{ name: "Pet", price: 25, pricingType: "per_stay", quantity: 1, taxable: false }] });
    expect(r).toMatchObject({ numNights: 3, baseSubtotal: 150, addOnsSubtotal: 25, taxableAmount: 150, taxAmount: 15, totalAmount: 190 });
  });

  it("per-night, per-person and per-unit add-ons", () => {
    const r = calculatePricing({
      ...base,
      adults: 3,
      addOns: [
        { name: "Cart", price: 45, pricingType: "per_night", quantity: 1, taxable: true }, // 135
        { name: "Tour", price: 10, pricingType: "per_person", quantity: 1, taxable: true }, // 30
        { name: "Wood", price: 8.5, pricingType: "per_unit", quantity: 2, taxable: true }, // 17
      ],
    });
    expect(r.addOnsSubtotal).toBe(182);
    expect(r.taxAmount).toBe(33.2);
    expect(r.totalAmount).toBe(365.2);
  });

  it("discounts apply to lodging only and are clamped", () => {
    expect(calculatePricing({ ...base, discountType: "percentage", discountValue: 10 }).discountAmount).toBe(15);
    expect(calculatePricing({ ...base, discountType: "percentage", discountValue: 250 }).discountAmount).toBe(150);
    expect(calculatePricing({ ...base, discountType: "fixed_amount", discountValue: 999 }).discountAmount).toBe(150);
  });

  it("balance never negative; minimum one night", () => {
    expect(calculatePricing({ ...base, paidAmount: 10_000 }).balanceDue).toBe(0);
    expect(calculatePricing({ ...base, checkOutDate: "2026-06-01" }).numNights).toBe(1);
  });

  it("avoids floating point drift", () => {
    const r = calculatePricing({ nightlyRate: 19.99, checkInDate: "2026-01-01", checkOutDate: "2026-01-04", taxRatePercent: 7.5 });
    expect(r.baseSubtotal).toBe(59.97);
    expect(r.taxAmount).toBe(4.5);
    expect(r.totalAmount).toBe(64.47);
  });
});

describe("date utilities", () => {
  it("hotel overlap semantics: same-day turnover is allowed", () => {
    expect(isDateOverlap("2026-06-01", "2026-06-03", "2026-06-03", "2026-06-05")).toBe(false);
    expect(isDateOverlap("2026-06-01", "2026-06-04", "2026-06-03", "2026-06-05")).toBe(true);
    // ported from legacy tests/drag-drop.test.ts
    expect(isDateOverlap("2026-08-01", "2026-08-10", "2026-08-03", "2026-08-05")).toBe(true); // enclosed
    expect(isDateOverlap("2026-08-05", "2026-08-07", "2026-08-01", "2026-08-05")).toBe(false); // reverse back-to-back
  });

  it("diffDays across DST is exact", () => {
    expect(diffDays("2026-03-07", "2026-03-09")).toBe(2);
    expect(diffDays("2026-10-31", "2026-11-02")).toBe(2);
  });

  it("zonedDateKey uses the park's calendar day", () => {
    const evening = new Date("2026-11-12T03:30:00Z"); // 20:30 on Nov 11 in Denver
    expect(zonedDateKey(evening, "America/Denver")).toBe("2026-11-11");
    expect(zonedDateKey(evening, "UTC")).toBe("2026-11-12");
    expect(zonedDateKey(evening, "Not/AZone")).toBe("2026-11-12"); // invalid tz falls back to UTC
  });

  it("zonedMidnight returns the real instant of local midnight, DST-aware", () => {
    expect(zonedMidnight("2026-11-11", "America/Denver").toISOString()).toBe("2026-11-11T07:00:00.000Z"); // MST
    expect(zonedMidnight("2026-07-01", "America/Denver").toISOString()).toBe("2026-07-01T06:00:00.000Z"); // MDT
    expect(zonedMidnight("2026-07-01", "UTC").toISOString()).toBe(parseDateOnly("2026-07-01").toISOString());
  });
});

describe("reservation status rules", () => {
  it("allows the normal lifecycle and blocks nonsense", () => {
    expect(canTransition("confirmed", "checked_in")).toBe(true);
    expect(canTransition("checked_in", "checked_out")).toBe(true);
    expect(canTransition("cancelled", "checked_in")).toBe(false);
    expect(canTransition("checked_out", "cancelled")).toBe(false);
    expect(canTransition("pending", "checked_out")).toBe(false);
    expect(canTransition("confirmed", "confirmed")).toBe(true);
  });
  it("blocking statuses", () => {
    expect(["pending", "confirmed", "checked_in"].every((s) => isBlocking(s as any))).toBe(true);
    expect(isBlocking("cancelled")).toBe(false);
  });
});

describe("misc utilities", () => {
  it("escapeRegex neutralises metacharacters", () => {
    expect(new RegExp(escapeRegex("a.b*(c)")).test("a.b*(c)")).toBe(true);
    expect(new RegExp(escapeRegex("a.b")).test("axb")).toBe(false);
  });
  it("confirmation codes are well-formed and unique enough", () => {
    const codes = new Set(Array.from({ length: 5000 }, () => generateConfirmationCode()));
    expect(codes.size).toBe(5000);
    for (const c of Array.from(codes).slice(0, 50)) expect(c).toMatch(/^RV-[2-9A-HJ-NP-Z]{8}$/);
  });
  it("toDotPaths flattens nested partial updates", () => {
    expect(toDotPaths({ name: "x", rvDetails: { lengthFt: 35 }, amenities: ["a"], skip: undefined })).toEqual({
      name: "x",
      "rvDetails.lengthFt": 35,
      amenities: ["a"],
    });
  });
});
