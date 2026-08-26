import { sendEmail } from "../lib/mail/resend";
import { MailService } from "../services/mail.service";

async function runAudit() {
  console.log("=== RUNNING FULL RESEND MAIL SYSTEM AUDIT ===");

  // 1. Test Booking Confirmation Email
  console.log("\n--- TEST 1: Public Booking Confirmation Email ---");
  const bookingRes = await MailService.sendBookingConfirmation({
    to: "guest.camper@gmail.com",
    confirmationCode: "CF-892147",
    guestName: "Marcus Holloway",
    propertyName: "CampFlow Mountain View RV Resort",
    propertyPhone: "(555) 234-5678",
    propertyEmail: "info@campflow.com",
    propertyAddress: "100 Pine Valley Way, Mountain View, CO",
    siteNumber: "22",
    siteTypeName: "50 Amp Full Hookup Pull-Through",
    checkInDate: "2026-09-01",
    checkOutDate: "2026-09-05",
    numNights: 4,
    adults: 2,
    children: 1,
    pets: 1,
    pricing: {
      nightlyRate: 65,
      baseSubtotal: 260,
      addOnsSubtotal: 35,
      taxAmount: 22.13,
      totalAmount: 317.13,
      paidAmount: 317.13,
      balanceDue: 0,
    },
    addOns: [
      { name: "Firewood Bundle (Kiln-Dried)", quantity: 2, subtotal: 18 },
      { name: "WiFi High-Speed VIP Pass", quantity: 1, subtotal: 17 },
    ],
    slug: "campflow-rv-resort",
  });
  console.log("Booking Confirmation Result:", bookingRes);

  // 2. Test Mass Broadcast Email
  console.log("\n--- TEST 2: Mass Broadcast Announcement ---");
  const broadcastRes = await MailService.sendMassBroadcast({
    recipients: ["inhouse.camper1@gmail.com", "inhouse.camper2@gmail.com"],
    propertyName: "CampFlow Mountain View RV Resort",
    subject: "Severe Weather Warning: High Wind Gusts Tonight",
    messageBody:
      "A severe wind advisory has been issued. Please retract RV awnings and secure outdoor items.\nClubhouse storm shelter is open 24/7.",
    priority: "weather_alert",
    propertyPhone: "(555) 234-5678",
    propertyEmail: "info@campflow.com",
  });
  console.log("Mass Broadcast Result:", broadcastRes);

  // 3. Test Registration Welcome Email
  console.log("\n--- TEST 3: Registration Welcome Email ---");
  const welcomeRes = await MailService.sendRegistrationWelcome({
    to: "newowner@campground.com",
    userName: "Navnit Rai",
    organizationName: "CampFlow Enterprise",
    propertyName: "CampFlow Mountain View RV Resort",
  });
  console.log("Registration Welcome Result:", welcomeRes);

  console.log("\n🎉 FULL EMAIL AUDIT COMPLETED!");
}

runAudit();
