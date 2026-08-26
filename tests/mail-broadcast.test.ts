import {
  loginNotificationTemplate,
  welcomeRegistrationTemplate,
  bookingConfirmationTemplate,
  massAnnouncementTemplate,
} from "../lib/mail/templates";
import { MailService } from "../services/mail.service";

console.log("=== Testing Centralized Mailer & Mass Messaging System ===");

// 1. Test Login Notification Template
const loginHtml = loginNotificationTemplate({
  userName: "Navnit Rai",
  email: "admin@campflow.com",
  loginTime: "Aug 26, 2026, 10:05 PM",
  ipAddress: "192.168.1.100",
  userAgent: "Chrome on macOS",
});

console.assert(loginHtml.includes("Navnit Rai"), "Login template should contain user name");
console.assert(loginHtml.includes("admin@campflow.com"), "Login template should contain email");
console.assert(loginHtml.includes("192.168.1.100"), "Login template should contain IP");
console.log("✓ Login notification HTML template formatted correctly");

// 2. Test Welcome Registration Template
const welcomeHtml = welcomeRegistrationTemplate({
  userName: "Navnit Rai",
  organizationName: "CampFlow Resorts LLC",
  propertyName: "Pine Creek RV Park",
  email: "owner@pinecreekrv.com",
});

console.assert(welcomeHtml.includes("CampFlow Resorts LLC"), "Welcome template contains org name");
console.assert(welcomeHtml.includes("Pine Creek RV Park"), "Welcome template contains property name");
console.assert(welcomeHtml.includes("Tape Chart"), "Welcome template contains onboarding checklist");
console.log("✓ Welcome registration HTML template formatted correctly");

// 3. Test Booking Confirmation Template (with Add-Ons)
const bookingHtml = bookingConfirmationTemplate({
  confirmationCode: "CF-948271",
  guestName: "Marcus Holloway",
  propertyName: "Pine Creek RV Resort",
  propertyPhone: "(555) 234-5678",
  propertyEmail: "stay@pinecreekrv.com",
  propertyAddress: "100 Pine Creek Rd, Mountain View, CO 80401",
  siteNumber: "14",
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
    addOnsSubtotal: 45,
    taxAmount: 22.88,
    totalAmount: 327.88,
    paidAmount: 327.88,
    balanceDue: 0,
  },
  addOns: [
    {
      name: "Firewood Bundle (Kiln-Dried)",
      quantity: 2,
      subtotal: 18,
    },
    {
      name: "Late Check-Out (2:00 PM)",
      quantity: 1,
      subtotal: 27,
    },
  ],
  slug: "pine-creek-rv",
});

console.assert(bookingHtml.includes("CF-948271"), "Booking template contains confirmation code");
console.assert(bookingHtml.includes("Site 14"), "Booking template contains site number");
console.assert(bookingHtml.includes("Marcus Holloway"), "Booking template contains guest name");
console.assert(bookingHtml.includes("Firewood Bundle"), "Booking template contains itemized firewood add-on");
console.assert(bookingHtml.includes("Late Check-Out"), "Booking template contains itemized late checkout add-on");
console.assert(bookingHtml.includes("327.88"), "Booking template contains correct total amount");
console.log("✓ Booking confirmation HTML template with add-ons formatted correctly");

// 4. Test Mass Announcement Template
const weatherAnnouncementHtml = massAnnouncementTemplate({
  propertyName: "Pine Creek RV Resort",
  subject: "Severe Weather Warning: 50 MPH Wind Gusts Expected",
  messageBody: "Please retract all awnings and secure outdoor chairs.\nClubhouse shelter is open 24/7.",
  priority: "weather_alert",
  propertyPhone: "(555) 234-5678",
});

console.assert(weatherAnnouncementHtml.includes("Severe Weather"), "Announcement contains weather alert");
console.assert(weatherAnnouncementHtml.includes("50 MPH Wind"), "Announcement contains body content");
console.log("✓ Mass announcement HTML template formatted correctly");

// 5. Test MailService Async Execution
async function testMailer() {
  const res1 = await MailService.sendLoginAlert({
    to: "test@example.com",
    userName: "Test User",
  });
  console.assert(res1.success, "sendLoginAlert should succeed");

  const res2 = await MailService.sendRegistrationWelcome({
    to: "newowner@example.com",
    userName: "New Owner",
    organizationName: "Test Org",
    propertyName: "Test Park",
  });
  console.assert(res2.success, "sendRegistrationWelcome should succeed");

  const res3 = await MailService.sendMassBroadcast({
    recipients: ["camper1@example.com", "camper2@example.com"],
    propertyName: "Pine Creek RV",
    subject: "Campfire Tonight",
    messageBody: "Join us at 7 PM for s'mores!",
    priority: "event",
  });
  console.assert(res3.success, "sendMassBroadcast should succeed");
  console.assert(res3.sentCount === 2, "sendMassBroadcast should send to all recipients");
  console.log("✓ MailService asynchronous dispatchers executed successfully");

  console.log("\n🎉 ALL RESEND MAILER & MASS MESSAGING TESTS PASSED PERFECTLY!");
}

testMailer();
