import { describe, it, expect } from "vitest";
import {
  bookingConfirmationTemplate,
  massAnnouncementTemplate,
  loginNotificationTemplate,
} from "@/lib/mail/templates";

const XSS = `<a href="https://evil.example">Pay here</a><script>alert(1)</script>`;

// Regression for audit H12: guest/staff-controlled text was interpolated raw into email HTML.
describe("email templates escape user-controlled content", () => {
  it("booking confirmation escapes guest name and add-on names", () => {
    const html = bookingConfirmationTemplate({
      guestName: XSS,
      confirmationCode: "RV-ABCDEFGH",
      propertyName: "Park",
      siteNumber: "A1",
      siteTypeName: "Full",
      checkInDate: "2030-06-01",
      checkOutDate: "2030-06-03",
      numNights: 2,
      adults: 2,
      children: 0,
      pets: 0,
      pricing: { nightlyRate: 50, baseSubtotal: 100, taxAmount: 10, totalAmount: 110, paidAmount: 0, balanceDue: 110 },
      addOns: [{ name: XSS, price: 1, pricingType: "per_stay", quantity: 1, subtotal: 1, taxable: true }],
    } as any);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(html).toContain("&lt;script&gt;");
  });

  it("broadcast escapes subject/body but keeps paragraph formatting", () => {
    const html = massAnnouncementTemplate({
      propertyName: "Park",
      subject: XSS,
      messageBody: `line one\n${XSS}`,
      priority: "general",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain('<p style="margin:0 0 12px;line-height:1.6;">line one</p>');
  });

  it("login alert escapes user name", () => {
    const html = loginNotificationTemplate({ userName: XSS, email: "a@b.com", loginTime: "now" } as any);
    expect(html).not.toContain("<script>");
  });
});
