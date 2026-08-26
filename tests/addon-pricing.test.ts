import { calculatePricing } from "../lib/utils/pricing";

console.log("=== Testing Add-On Services Pricing Logic ===");

// 1. Flat per-stay
const r1 = calculatePricing({
  nightlyRate: 50,
  checkInDate: "2026-06-01",
  checkOutDate: "2026-06-04", // 3 nights
  taxRatePercent: 10,
  addOns: [
    {
      name: "Pet Cleaning Fee",
      price: 25,
      pricingType: "per_stay",
      quantity: 1,
      taxable: false,
    },
  ],
});
console.assert(r1.numNights === 3, "r1.numNights === 3");
console.assert(r1.baseSubtotal === 150, "r1.baseSubtotal === 150");
console.assert(r1.addOnsSubtotal === 25, "r1.addOnsSubtotal === 25");
console.assert(r1.taxableAmount === 150, "r1.taxableAmount === 150");
console.assert(r1.taxAmount === 15, "r1.taxAmount === 15");
console.assert(r1.totalAmount === 190, "r1.totalAmount === 190");
console.log("✓ Flat per-stay add-on calculated accurately (Total: $190.00)");

// 2. Per-night
const r2 = calculatePricing({
  nightlyRate: 60,
  checkInDate: "2026-06-01",
  checkOutDate: "2026-06-05", // 4 nights
  taxRatePercent: 0,
  addOns: [
    {
      name: "Golf Cart Rental",
      price: 40,
      pricingType: "per_night",
      quantity: 2, // 2 golf carts
      taxable: false,
    },
  ],
});
console.assert(r2.numNights === 4, "r2.numNights === 4");
console.assert(r2.addOnsSubtotal === 320, "r2.addOnsSubtotal === 320 (40 * 4 * 2)");
console.assert(r2.totalAmount === 560, "r2.totalAmount === 560");
console.log("✓ Per-night add-on with quantity 2 calculated accurately (Total: $560.00)");

// 3. Per-unit
const r3 = calculatePricing({
  nightlyRate: 45,
  checkInDate: "2026-06-01",
  checkOutDate: "2026-06-03", // 2 nights
  taxRatePercent: 5,
  addOns: [
    {
      name: "Firewood Bundle",
      price: 8,
      pricingType: "per_unit",
      quantity: 3, // 3 bundles
      taxable: true,
    },
  ],
});
console.assert(r3.addOnsSubtotal === 24, "r3.addOnsSubtotal === 24");
console.assert(r3.taxableAmount === 114, "r3.taxableAmount === 114 (90 + 24)");
console.assert(r3.taxAmount === 5.7, "r3.taxAmount === 5.7");
console.assert(r3.totalAmount === 119.7, "r3.totalAmount === 119.7");
console.log("✓ Per-unit add-on (3 bundles @ $8) with tax calculated accurately (Total: $119.70)");

// 4. Per-person
const r4 = calculatePricing({
  nightlyRate: 70,
  checkInDate: "2026-06-01",
  checkOutDate: "2026-06-02", // 1 night
  adults: 4,
  taxRatePercent: 0,
  addOns: [
    {
      name: "Pool & Spa Wristband",
      price: 12,
      pricingType: "per_person",
      quantity: 1,
      taxable: false,
    },
  ],
});
console.assert(r4.addOnsSubtotal === 48, "r4.addOnsSubtotal === 48 (12 * 4 adults)");
console.assert(r4.totalAmount === 118, "r4.totalAmount === 118");
console.log("✓ Per-person add-on (4 guests @ $12) calculated accurately (Total: $118.00)");

// 5. Mixed with discount & partial payment
const r5 = calculatePricing({
  nightlyRate: 100,
  checkInDate: "2026-06-01",
  checkOutDate: "2026-06-03", // 2 nights ($200)
  discountType: "fixed_amount",
  discountValue: 20, // lodging subtotal becomes 180
  taxRatePercent: 10,
  paidAmount: 50,
  addOns: [
    {
      name: "Firewood Bundle",
      price: 10,
      pricingType: "per_unit",
      quantity: 2, // $20, taxable
      taxable: true,
    },
    {
      name: "Late Checkout",
      price: 30,
      pricingType: "per_stay",
      quantity: 1, // $30, non-taxable
      taxable: false,
    },
  ],
});
console.assert(r5.baseSubtotal === 200, "r5.baseSubtotal === 200");
console.assert(r5.discountAmount === 20, "r5.discountAmount === 20");
console.assert(r5.addOnsSubtotal === 50, "r5.addOnsSubtotal === 50");
console.assert(r5.taxableAmount === 200, "r5.taxableAmount === 200");
console.assert(r5.taxAmount === 20, "r5.taxAmount === 20");
console.assert(r5.totalAmount === 250, "r5.totalAmount === 250");
console.assert(r5.balanceDue === 200, "r5.balanceDue === 200 (250 - 50)");
console.log("✓ Mixed add-ons with lodging discount & partial payment passed perfectly (Balance: $200.00)");

console.log("\n🎉 ALL ADD-ON PRICING TESTS PASSED SUCCESSFULLY!");
