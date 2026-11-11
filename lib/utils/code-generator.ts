import { randomInt } from "node:crypto";

const CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no ambiguous 0/O, 1/I

/**
 * Generates a confirmation code using a CSPRNG.
 * 8 chars from a 32-char alphabet ≈ 1.1e12 combinations (was 5 chars ≈ 3.3e7 with Math.random),
 * which makes the public confirmation lookup impractical to enumerate.
 */
export function generateConfirmationCode(prefix = "RV", length = 8): string {
  let result = "";
  for (let i = 0; i < length; i++) result += CHARS[randomInt(CHARS.length)];
  return `${prefix}-${result}`;
}
