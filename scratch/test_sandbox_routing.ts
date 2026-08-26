import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

async function testSandboxRouting() {
  const targetRecipient = "camper.marcus@gmail.com";
  const subject = "🏕️ Booking Confirmed: CF-948271 at CampFlow RV Resort";
  let html = "<h2>Your Booking is Confirmed!</h2><p>Site: 14</p>";

  console.log(`Sending to target: ${targetRecipient}...`);
  const initialSend = await resend.emails.send({
    from: "CampFlow <onboarding@resend.dev>",
    to: targetRecipient,
    subject,
    html,
  });

  if (initialSend.error) {
    console.log("Initial send failed with error:", initialSend.error.message);

    // Extract registered email if present in message or fallback
    const match = initialSend.error.message.match(/\(([^)]+@resend\.dev|[^)]+@gmail\.com|[^)]+@[^)]+)\)/i);
    const sandboxEmail = match ? match[1] : "navnitrai7355@gmail.com";

    console.log(`Routing via sandbox to registered email: ${sandboxEmail}...`);
    const banner = `
      <div style="background-color:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:12px 16px;margin:15px auto;max-width:600px;font-size:12px;color:#1e40af;font-family:sans-serif;">
        <strong>📬 Resend Sandbox Delivery Notice:</strong><br/>
        This email was generated for: <strong>${targetRecipient}</strong>.<br/>
        <em>Delivered to your registered testing address (<strong>${sandboxEmail}</strong>) in development mode.</em>
      </div>
    `;

    const retrySend = await resend.emails.send({
      from: "CampFlow <onboarding@resend.dev>",
      to: sandboxEmail,
      subject: `[CampFlow Sandbox -> ${targetRecipient}] ${subject}`,
      html: banner + html,
    });

    console.log("Retry result:", JSON.stringify(retrySend, null, 2));
  } else {
    console.log("Initial send succeeded directly:", initialSend.data);
  }
}

testSandboxRouting();
