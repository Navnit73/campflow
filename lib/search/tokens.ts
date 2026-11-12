import { escapeRegex } from "@/lib/utils/regex";

/**
 * Indexed word-prefix search.
 *
 * A substring `$regex` can't use an index, so a search for a term that matches nothing scanned
 * every document in the property. Instead each searchable document stores normalized tokens
 * (lowercase, accent-free words, phone digits + last 4, compact confirmation code) in a multikey
 * index, and a search becomes anchored prefix matches on that index: "smi" → Smith, "5551" → phone,
 * "rv7mn" → RV-7MN…, "gmail" → …@gmail.com. Matching is per word prefix ("mith" does not match "Smith").
 */

const MAX_TOKENS = 48;
const MAX_TOKEN_LEN = 40;

function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function words(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.slice(0, MAX_TOKEN_LEN));
}

export interface TokenSource {
  text?: (string | null | undefined)[];
  phones?: (string | null | undefined)[];
  codes?: (string | null | undefined)[];
}

export function buildSearchTokens(src: TokenSource): string[] {
  const out = new Set<string>();
  for (const t of src.text || []) if (t) words(String(t)).forEach((w) => out.add(w));
  for (const p of src.phones || []) {
    const digits = String(p || "").replace(/\D/g, "");
    if (digits.length >= 4) {
      out.add(digits.slice(0, MAX_TOKEN_LEN));
      out.add(digits.slice(-4));
    }
  }
  for (const c of src.codes || []) {
    if (!c) continue;
    words(String(c)).forEach((w) => out.add(w));
    out.add(normalize(String(c)).replace(/[^a-z0-9]/g, "")); // "rv-7mnd4w7s" → "rv7mnd4w7s"
  }
  return Array.from(out).slice(0, MAX_TOKENS);
}

/** Splits user search input into normalized word prefixes (max 5 words). */
export function searchWords(input: string): string[] {
  return words(input).slice(0, 5);
}

/** Mongo filter: every input word must prefix-match some token (index-backed, anchored regex). */
export function tokenFilter(input: string): Record<string, unknown> | null {
  const ws = searchWords(input);
  if (ws.length === 0) return null;
  const clauses = ws.map((w) => ({ searchTokens: { $regex: `^${escapeRegex(w)}` } }));
  return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

export function reservationTokens(r: {
  confirmationCode?: string;
  guestSnapshot?: { fullName?: string; email?: string; phone?: string };
  siteSnapshot?: { siteNumber?: string };
}): string[] {
  return buildSearchTokens({
    text: [r.guestSnapshot?.fullName, r.guestSnapshot?.email, r.siteSnapshot?.siteNumber],
    phones: [r.guestSnapshot?.phone],
    codes: [r.confirmationCode],
  });
}

export function guestTokens(g: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  rvDetails?: { licensePlate?: string };
}): string[] {
  return buildSearchTokens({
    text: [g.firstName, g.lastName, g.email, g.rvDetails?.licensePlate],
    phones: [g.phone],
  });
}
