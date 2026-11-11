import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

// If API key is provided, instantiate Resend, otherwise mock safe sender
export const resend = apiKey ? new Resend(apiKey) : null;

export const DEFAULT_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "CampFlow <onboarding@resend.dev>";

/**
 * Optional developer inbox for Resend sandbox mode. Never defaulted (no hardcoded address) and
 * never used in production, so one tenant's mail can't be diverted to a personal inbox.
 */
export const FALLBACK_TEST_EMAIL = process.env.RESEND_TEST_EMAIL || "";
const SANDBOX_REROUTE_ENABLED = process.env.NODE_ENV !== "production" && Boolean(FALLBACK_TEST_EMAIL);

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
        `\n[Resend Mailer Simulated] To: ${recipients.length} recipient(s) | Subject: "${subject}" | Attachments: ${attachments?.length || 0}`
      );
      console.log(`[Resend Mailer] (Set RESEND_API_KEY in .env to deliver live emails)\n`);
      return { success: true, id: `sim_${Math.random().toString(36).substring(2, 11)}` };
    }

    console.log(`[Resend Mailer] Dispatching to ${recipients.length} recipient(s) (Attachments: ${attachments?.length || 0})...`);

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
      console.warn(`[Resend Warning] Send to ${recipients.length} recipient(s) returned error:`, error.message);

      // Check if this is Resend sandbox constraint (403 validation_error on unverified domain)
      // Only the explicit Resend sandbox restriction qualifies (not rate limits or other errors).
      const isSandboxRestriction = Boolean(
        error.message?.includes("You can only send testing emails to your own email address")
      );

      if (isSandboxRestriction && SANDBOX_REROUTE_ENABLED) {
        const sandboxTarget = FALLBACK_TEST_EMAIL;

        console.log(`[Resend Sandbox Route] 📬 Routing email to verified test inbox: ${sandboxTarget}...`);

        const sandboxNotice = `
          <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin:15px auto 20px;max-width:600px;font-size:12px;color:#1e40af;font-family:sans-serif;line-height:1.5;">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">📬 Resend Sandbox Delivery Mode</div>
            <div>Originally addressed to: <strong>${recipients.length} recipient(s)</strong>${attachments?.length ? ` · ${attachments.length} attachment(s) withheld` : ""}</div>
            <div style="margin-top:4px;color:#3b82f6;font-size:11px;">
              Delivered to your verified testing email (<strong>${sandboxTarget}</strong>). To send directly to external guest domains, verify your park domain at <a href="https://resend.com/domains" style="color:#1d4ed8;text-decoration:underline;">resend.com/domains</a> and set <code>RESEND_FROM_EMAIL</code>.
            </div>
          </div>
        `;

        const fallbackResult = await resend.emails.send({
          from,
          to: sandboxTarget,
          subject: `[Sandbox] ${subject}`,
          html: sandboxNotice + html,
          replyTo,
          // Attachments (e.g. exports containing guest PII) are never forwarded to the test inbox.
        });

        if (fallbackResult.error) {
          console.error("[Resend Error on Sandbox Retry]:", fallbackResult.error);
          return { success: false, error: fallbackResult.error.message };
        }

        console.log(`[Resend Success] ✅ Email successfully delivered to sandbox test email: ${sandboxTarget} (ID: ${fallbackResult.data?.id})`);
        // Not delivered to the real recipient → report as not successful.
        return {
          success: false,
          error: "Delivered to sandbox test inbox only (Resend domain not verified)",
          id: fallbackResult.data?.id,
          routedTo: sandboxTarget,
        };
      }

      return { success: false, error: error.message };
    }

    console.log(`[Resend Success] Delivered to ${recipients.length} recipient(s) (ID: ${data?.id})`);
    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error("[Resend Exception]:", err);
    return { success: false, error: err.message || "Failed to send email" };
  }
}

/* ------------------------------------------------------------------ */
/* Batch sending (Resend batch API: up to 100 emails per request).     */
/* ------------------------------------------------------------------ */

export const BATCH_SIZE = 100;
const MIN_INTERVAL_MS = 600; // stays under Resend's default 2 requests/second
const MAX_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface BatchEmail {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends one chunk (≤100) via the batch API. The idempotency key makes a retried chunk a no-op
 * on Resend's side (24h window), so a crash/retry can't double-send. Retries 429/5xx with backoff.
 */
export async function sendEmailBatch(
  emails: BatchEmail[],
  idempotencyKey: string,
  from: string = DEFAULT_FROM_EMAIL
): Promise<{ sent: number; failed: number; error?: string }> {
  if (emails.length === 0) return { sent: 0, failed: 0 };
  if (emails.length > BATCH_SIZE) throw new Error(`Batch exceeds ${BATCH_SIZE} emails`);

  if (!resend) {
    console.log(`[Resend Mailer Simulated] Batch of ${emails.length} email(s) (key ${idempotencyKey})`);
    return { sent: emails.length, failed: 0 };
  }

  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { error } = await resend.batch.send(
        emails.map((e) => ({ from, to: [e.to], subject: e.subject, html: e.html })),
        { idempotencyKey }
      );
      if (!error) return { sent: emails.length, failed: 0 };
      lastError = error.message;
      const retryable = /rate|429|timeout|5\d\d|internal/i.test(`${error.name} ${error.message}`);
      if (!retryable) break;
    } catch (err: unknown) {
      lastError = (err as Error)?.message || "Batch send failed";
    }
    await sleep(MIN_INTERVAL_MS * 2 ** attempt);
  }
  console.warn(`[Resend Batch] Chunk failed after retries: ${lastError}`);
  return { sent: 0, failed: emails.length, error: lastError };
}

/** Sends many emails in paced batches, reporting progress after each chunk. */
export async function sendEmailsPaced(
  emails: BatchEmail[],
  keyPrefix: string,
  onChunk?: (result: { sent: number; failed: number; chunkIndex: number }) => Promise<void> | void
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (let i = 0, chunkIndex = 0; i < emails.length; i += BATCH_SIZE, chunkIndex++) {
    const started = Date.now();
    const result = await sendEmailBatch(emails.slice(i, i + BATCH_SIZE), `${keyPrefix}-${chunkIndex}`);
    sent += result.sent;
    failed += result.failed;
    await onChunk?.({ ...result, chunkIndex });
    const elapsed = Date.now() - started;
    if (i + BATCH_SIZE < emails.length && resend && elapsed < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - elapsed);
  }
  return { sent, failed };
}
