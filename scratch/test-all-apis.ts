import { SeedService } from "../services/seed.service";
import { AuthService } from "../services/auth.service";
import { SiteService } from "../services/site.service";
import { GuestService } from "../services/guest.service";
import { ReservationService } from "../services/reservation.service";
import { PaymentService } from "../services/payment.service";
import { ReportService } from "../services/report.service";
import { PublicBookingService } from "../services/public-booking.service";
import { connectDB } from "../lib/db/connection";

async function runAudit() {
  console.log("==================================================");
  console.log("CAMPFLOW SAAS COMPREHENSIVE BACKEND & API AUDIT");
  console.log("==================================================");

  await connectDB();

  // 1. SEED
  console.log("\n[TEST 1] Seeding Demo Database...");
  const seedRes = await SeedService.seedDemoData();
  console.log("✓ Seed completed:", seedRes.demoCredentials);

  // 2. AUTH LOGIN
  console.log("\n[TEST 2] Testing Auth Login...");
  const loginRes = await AuthService.login({
    email: "demo@pineridgerv.com",
    password: "password123",
  });
  console.log("✓ Logged in as:", loginRes.user.name, "| Role:", loginRes.user.role);
  const orgId = loginRes.user.organizationId;
  const propId = loginRes.user.propertyId;

  // 3. AUTH REGISTER
  console.log("\n[TEST 3] Testing Auth Registration for new Park...");
  const regEmail = `test.owner.${Date.now()}@camppark.com`;
  const regRes = await AuthService.register({
    name: "Alex Morgan",
    organizationName: "Rocky Peak Campground",
    email: regEmail,
    phone: "(970) 555-9988",
    password: "securepassword123",
  });
  console.log("✓ New Park registered:", regRes.organization.name, "| Slug:", regRes.organization.slug);

  // 4. SITES INVENTORY
  console.log("\n[TEST 4] Testing Sites & Site Types CRUD (Pine Ridge)...");
  const siteTypes = await SiteService.listSiteTypes(orgId, propId);
  console.log(`✓ Fetched ${siteTypes.length} site types`);

  const sites = await SiteService.listSites(orgId, propId);
  console.log(`✓ Fetched ${sites.length} total campground sites`);

  const newSite = await SiteService.createSite(orgId, propId, {
    siteNumber: "X-99",
    name: "VIP Panoramic Pull-Through",
    siteTypeId: siteTypes[0]._id.toString(),
    status: "available",
    currentBaseRate: 95,
    surfaceType: "concrete",
    rigType: "pull_through",
    amenities: ["Panoramic Mountain View", "50A Hookup", "Fire Pit"],
    notes: "New test site",
  });
  console.log("✓ Created Site X-99:", newSite.name, "| Rate: $" + newSite.currentBaseRate);

  const updatedSite = await SiteService.updateSite(orgId, propId, newSite._id.toString(), {
    currentBaseRate: 99,
  });
  console.log("✓ Updated Site X-99 new rate: $" + updatedSite.currentBaseRate);

  // 5. GUESTS CRM
  console.log("\n[TEST 5] Testing Guests CRM Search & Profiles...");
  const guestList = await GuestService.listGuests(orgId, propId, { page: 1, limit: 10 });
  console.log(`✓ Retrieved ${guestList.guests.length} guests (Total: ${guestList.pagination.total})`);

  const testGuest = await GuestService.createGuest(orgId, propId, {
    firstName: "Laura",
    lastName: "Croft",
    email: `laura.${Date.now()}@adventure.com`,
    phone: "(303) 555-8822",
    rvDetails: {
      type: "motorhome_a",
      lengthFt: 40,
      licensePlate: "CO-EXPLR",
    },
    isVip: true,
    notes: "Prefers quiet mountain loop",
  });
  console.log("✓ Created Guest:", testGuest.firstName, testGuest.lastName, "| VIP:", testGuest.isVip);

  // 6. RESERVATIONS & CONFLICT DETECTION
  console.log("\n[TEST 6] Testing Reservation Creation & Conflict Engine...");
  const today = new Date().toISOString().split("T")[0];
  const threeDaysOut = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const sixDaysOut = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const res1 = await ReservationService.createReservation(orgId, propId, {
    siteId: newSite._id.toString(),
    guestId: testGuest._id.toString(),
    checkInDate: threeDaysOut,
    checkOutDate: sixDaysOut,
    adults: 2,
    children: 0,
    pets: 1,
    status: "confirmed",
    source: "admin",
  });
  console.log("✓ Created Reservation:", res1.confirmationCode, "| Total: $" + res1.pricing.totalAmount, "| Nights:", res1.numNights);

  // Attempt conflicting overlap booking
  console.log("→ Testing Conflict Prevention on overlapping dates (should fail)...");
  let conflictCaught = false;
  try {
    const overlapIn = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const overlapOut = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    await ReservationService.createReservation(orgId, propId, {
      siteId: newSite._id.toString(),
      guestId: testGuest._id.toString(),
      checkInDate: overlapIn,
      checkOutDate: overlapOut,
      adults: 2,
      children: 0,
      pets: 0,
    });
  } catch (err: any) {
    conflictCaught = true;
    console.log("✓ Expected conflict correctly prevented:", err.message);
  }

  if (!conflictCaught) {
    throw new Error("FAILED: Overlapping reservation was not rejected by conflict engine!");
  }

  // 7. DESK CHECK-IN / CHECK-OUT
  console.log("\n[TEST 7] Testing Desk Operations (Check-In / Check-Out)...");
  const checkedInRes = await ReservationService.checkIn(orgId, propId, res1._id.toString());
  console.log("✓ Check-In status:", checkedInRes.status, "| Actual Time:", checkedInRes.checkInTimeActual);

  const checkedOutRes = await ReservationService.checkOut(orgId, propId, res1._id.toString());
  console.log("✓ Check-Out status:", checkedOutRes.status, "| Actual Time:", checkedOutRes.checkOutTimeActual);

  // 8. TAPE CHART MATRIX
  console.log("\n[TEST 8] Testing Tape Chart Timeline Matrix Data...");
  const tapeChart = await ReservationService.getTapeChartData(orgId, propId, today, 14);
  console.log(`✓ Tape chart loaded: ${tapeChart.sites.length} sites, ${tapeChart.reservations.length} active bookings across ${tapeChart.days} days`);

  // 9. PAYMENTS & BALANCE RECONCILIATION
  console.log("\n[TEST 9] Testing Payment Recording & Ledger Balance...");
  const payRes = await PaymentService.recordPayment(orgId, propId, {
    reservationId: res1._id.toString(),
    amount: res1.pricing.totalAmount,
    method: "credit_card",
    status: "completed",
    transactionReference: "AUTH-AUDIT-9921",
    notes: "Full payment test",
  });
  console.log("✓ Payment recorded: $" + payRes.payment.amount, "| Updated balance due: $" + payRes.reservation.pricing.balanceDue);

  // 10. REPORTS & OCCUPANCY
  console.log("\n[TEST 10] Testing 30-Day Financial & Occupancy Reports...");
  const report = await ReportService.getFinancialReports(orgId, propId, 30);
  console.log("✓ Report Summary:", report.summary);
  console.log("✓ Revenue by Site Category:", report.revenueBySiteType);

  // 11. PUBLIC BOOKING PORTAL FLOW
  console.log("\n[TEST 11] Testing Public Camper Online Booking Flow...");
  const pubAvail = await PublicBookingService.searchAvailableSites({
    slug: "pine-ridge-rv",
    checkInDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    checkOutDate: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    rigLengthFt: 35,
    rvType: "fifth_wheel",
    adults: 2,
    children: 0,
    pets: 1,
  });
  console.log(`✓ Public availability returned ${pubAvail.availableSites.length} available sites for 35ft rig`);

  if (pubAvail.availableSites.length > 0) {
    const chosenSite = pubAvail.availableSites[0];
    const pubBooking = await PublicBookingService.createPublicBooking({
      slug: "pine-ridge-rv",
      siteId: chosenSite._id.toString(),
      checkInDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      checkOutDate: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      adults: 2,
      children: 0,
      pets: 1,
      guest: {
        firstName: "Nathan",
        lastName: "Drake",
        email: `nathan.${Date.now()}@uncharted.com`,
        phone: "(720) 555-1234",
        rvType: "fifth_wheel",
        rvLengthFt: 35,
        licensePlate: "CO-TREAS",
      },
      paymentMethod: "credit_card",
    });
    console.log("✓ Camper Public Booking created! Confirmation Code:", pubBooking.confirmationCode);

    const confPass = await PublicBookingService.getBookingConfirmation(pubBooking.confirmationCode);
    console.log("✓ Confirmation pass retrieved for:", confPass.guest?.firstName, confPass.guest?.lastName, "| Site:", confPass.site?.siteNumber);
  }

  // Cleanup test site
  await SiteService.deleteSite(orgId, propId, newSite._id.toString());
  console.log("✓ Cleaned up test site X-99");

  console.log("\n==================================================");
  console.log("🎉 ALL 11 AUDIT SUITES PASSED WITH ZERO ERRORS!");
  console.log("==================================================");
  process.exit(0);
}

runAudit().catch((err) => {
  console.error("❌ AUDIT FAILED:", err);
  process.exit(1);
});
