import { createHash } from "node:crypto";

export interface LoginContext {
  ip?: string;
  userAgent?: string;
}

export const MAX_KNOWN_DEVICES = 10;

/** Network prefix so a DHCP/IP change within the same network isn't a "new device". */
function networkPrefix(ip = ""): string {
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":"); // IPv6 /48
  const parts = ip.split(".");
  return parts.length === 4 ? parts.slice(0, 3).join(".") : ip; // IPv4 /24
}

/** One-way device fingerprint (user agent + network prefix). Raw IPs are never stored. */
export function deviceFingerprint(ctx: LoginContext = {}): string {
  return createHash("sha256").update(`${ctx.userAgent || ""}|${networkPrefix(ctx.ip)}`).digest("hex").slice(0, 32);
}
