import { timingSafeEqual } from "node:crypto";
import { UnauthorizedError } from "@/lib/utils/errors";

/**
 * Verifies `Authorization: Bearer <CRON_SECRET>` (the header Vercel Cron sends).
 * Fails closed: if CRON_SECRET is not configured the endpoint is disabled.
 */
export function requireCronSecret(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    throw new UnauthorizedError("Cron endpoint is disabled: CRON_SECRET is not configured");
  }
  const header = req.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedError("Invalid cron credentials");
  }
}
