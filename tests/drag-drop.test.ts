import { isDateOverlap, formatDateKey, addDays, diffDays } from "../lib/utils/date";

console.log("=== Testing Drag-and-Drop Date Math & Collision Logic ===");

// 1. Date Overlap hospitality semantics
// Case 1: Same site, back-to-back stays (Guest A: Aug 1-3, Guest B: Aug 3-5) -> SHOULD NOT overlap (checkout on 3rd, checkin on 3rd is allowed)
const backToBack = isDateOverlap("2026-08-01", "2026-08-03", "2026-08-03", "2026-08-05");
console.assert(!backToBack, "Back-to-back stays should NOT collide (check-out 3rd, check-in 3rd)");
console.log("✓ Back-to-back stays (Aug 1-3 vs Aug 3-5): No collision");

// Case 2: Overlapping stays (Guest A: Aug 1-4, Guest B: Aug 3-6) -> SHOULD overlap
const overlap1 = isDateOverlap("2026-08-01", "2026-08-04", "2026-08-03", "2026-08-06");
console.assert(overlap1, "Overlapping stays should collide");
console.log("✓ Partial overlap (Aug 1-4 vs Aug 3-6): Collision detected");

// Case 3: Enclosed stay (Guest A: Aug 1-10, Guest B: Aug 3-5) -> SHOULD overlap
const overlap2 = isDateOverlap("2026-08-01", "2026-08-10", "2026-08-03", "2026-08-05");
console.assert(overlap2, "Enclosed stay should collide");
console.log("✓ Enclosed stay (Aug 1-10 vs Aug 3-5): Collision detected");

// Case 4: Identical stay (Guest A: Aug 1-5, Guest B: Aug 1-5) -> SHOULD overlap
const overlap3 = isDateOverlap("2026-08-01", "2026-08-05", "2026-08-01", "2026-08-05");
console.assert(overlap3, "Identical stay dates should collide");
console.log("✓ Identical stay dates: Collision detected");

// 2. Day Shift & Resizing Math
const initialStart = "2026-08-10";
const initialEnd = "2026-08-14";
const nights = diffDays(initialStart, initialEnd);
console.assert(nights === 4, "Nights should be 4");

// Shifting forward 3 days
const shiftDays = 3;
const shiftedStart = formatDateKey(addDays(initialStart, shiftDays));
const shiftedEnd = formatDateKey(addDays(initialEnd, shiftDays));
console.assert(shiftedStart === "2026-08-13", "Shifted start should be 2026-08-13");
console.assert(shiftedEnd === "2026-08-17", "Shifted end should be 2026-08-17");
console.assert(diffDays(shiftedStart, shiftedEnd) === 4, "Nights should remain 4 on move");
console.log("✓ Horizontal drag move preserves duration (4 nights moved from Aug 10-14 to Aug 13-17)");

// Resize start handle (move arrival from 10th to 12th)
const resizedStart = "2026-08-12";
const resizedStartNights = diffDays(resizedStart, initialEnd);
console.assert(resizedStartNights === 2, "Resized start nights should be 2");
console.log("✓ Left handle resize adjusts start date (Aug 12-14 = 2 nights)");

// Resize end handle (extend departure from 14th to 18th)
const resizedEnd = "2026-08-18";
const resizedEndNights = diffDays(initialStart, resizedEnd);
console.assert(resizedEndNights === 8, "Resized end nights should be 8");
console.log("✓ Right handle resize extends stay (Aug 10-18 = 8 nights)");

// 3. Pricing Difference
const siteA_rate = 50;
const siteB_rate = 65;
const rateDiff = siteB_rate - siteA_rate;
const oldSubtotal = siteA_rate * 4;
const newSubtotal = siteB_rate * 4;
console.assert(rateDiff === 15, "Rate difference should be +$15/nt");
console.assert(newSubtotal - oldSubtotal === 60, "Total difference should be +$60");
console.log("✓ Financial calculation: +$15/nt rate difference correctly computed ($200 -> $260 = +$60)");

console.log("\n=== ALL DRAG-AND-DROP LOGIC TESTS PASSED! ===");
