import { Resend } from "resend";

async function testResendOwner() {
  const resend = new Resend(process.env.RESEND_API_KEY);

  console.log("Sending to account owner navnitrai7355@gmail.com...");
  const result = await resend.emails.send({
    from: "CampFlow <onboarding@resend.dev>",
    to: "navnitrai7355@gmail.com",
    subject: "🏕️ Live Resend Test: CampFlow Email Engine",
    html: "<h2>Welcome to CampFlow Email Engine!</h2><p>This is a live test email sent directly via Resend to your registered email.</p>",
  });

  console.log("Live Send Result:", JSON.stringify(result, null, 2));
}

testResendOwner();
