import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

// If API key is provided, instantiate Resend, otherwise mock safe sender
export const resend = apiKey ? new Resend(apiKey) : null;

export const DEFAULT_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "CampFlow <onboarding@resend.dev>";

export const FALLBACK_TEST_EMAIL =
  process.env.RESEND_TEST_EMAIL || "navnitrai7355@gmail.com";

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail({
  to,
  subject,
  html,
  from = DEFAULT_FROM_EMAIL,
  replyTo,
  attachments,
}: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string; routedTo?: string }> {
  try {
    const recipients = Array.isArray(to) ? to : [to];

    if (!resend) {
      // Local development simulated logging when no API key is set
      console.log(
        `\n[Resend Mailer Simulated] 📧 To: ${recipients.join(
          ", "
        )} | Subject: "${subject}" | Attachments: ${attachments?.length || 0}`
      );
      console.log(`[Resend Mailer] (Set RESEND_API_KEY in .env to deliver live emails)\n`);
      return { success: true, id: `sim_${Math.random().toString(36).substring(2, 11)}` };
    }

    console.log(`[Resend Mailer] 🚀 Dispatching to [${recipients.join(", ")}] with from "${from}" (Attachments: ${attachments?.length || 0})...`);

    // 1. First attempt direct send
    const { data, error } = await resend.emails.send({
      from,
      to: recipients,
      subject,
      html,
      replyTo,
      attachments,
    });

    if (error) {
      console.warn(`[Resend Warning] Initial send to ${recipients.join(", ")} returned error:`, error.message);

      // Check if this is Resend sandbox constraint (403 validation_error on unverified domain)
      const isSandboxRestriction =
        error.name === "validation_error" ||
        error.message?.includes("You can only send testing emails to your own email address") ||
        from.includes("onboarding@resend.dev");

      if (isSandboxRestriction) {
        // Extract allowed sandbox email from error message if possible
        const match = error.message?.match(/\(([^)]+@resend\.dev|[^)]+@gmail\.com|[^)]+@[^)]+)\)/i);
        const sandboxTarget = match ? match[1] : FALLBACK_TEST_EMAIL;

        console.log(`[Resend Sandbox Route] 📬 Routing email to verified test inbox: ${sandboxTarget}...`);

        const sandboxNotice = `
          <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin:15px auto 20px;max-width:600px;font-size:12px;color:#1e40af;font-family:sans-serif;line-height:1.5;">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">📬 Resend Sandbox Delivery Mode</div>
            <div>Originally addressed to: <strong>${recipients.join(", ")}</strong></div>
            <div style="margin-top:4px;color:#3b82f6;font-size:11px;">
              Delivered to your verified testing email (<strong>${sandboxTarget}</strong>). To send directly to external guest domains, verify your park domain at <a href="https://resend.com/domains" style="color:#1d4ed8;text-decoration:underline;">resend.com/domains</a> and set <code>RESEND_FROM_EMAIL</code>.
            </div>
          </div>
        `;

        const fallbackResult = await resend.emails.send({
          from,
          to: sandboxTarget,
          subject: `[Sandbox -> ${recipients[0]}] ${subject}`,
          html: sandboxNotice + html,
          replyTo,
          attachments,
        });

        if (fallbackResult.error) {
          console.error("[Resend Error on Sandbox Retry]:", fallbackResult.error);
          return { success: false, error: fallbackResult.error.message };
        }

        console.log(`[Resend Success] ✅ Email successfully delivered to sandbox test email: ${sandboxTarget} (ID: ${fallbackResult.data?.id})`);
        return {
          success: true,
          id: fallbackResult.data?.id,
          routedTo: sandboxTarget,
        };
      }

      return { success: false, error: error.message };
    }

    console.log(`[Resend Success] ✅ Live email successfully delivered to ${recipients.join(", ")} (ID: ${data?.id})`);
    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error("[Resend Exception]:", err);
    return { success: false, error: err.message || "Failed to send email" };
  }
}
