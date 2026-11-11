/**
 * Field allowlists for unauthenticated (public booking) responses.
 * Public endpoints must never return internal fields such as staff notes, guest CRM
 * data (VIP/blacklist flags, lifetime spend), organizationId, or payment references.
 */

type Doc = Record<string, unknown>;

function pick(obj: unknown, keys: readonly string[]): Doc | null {
  if (!obj || typeof obj !== "object") return null;
  const src = obj as Doc;
  const out: Doc = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  return out;
}

const PROPERTY_FIELDS = [
  "_id", "name", "slug", "description", "address", "coordinates", "phone", "email", "timezone",
  "currency", "checkInTime", "checkOutTime", "rules", "amenities", "taxRatePercent", "bookingPolicy", "quietHours",
] as const;

const SITE_FIELDS = [
  "_id", "siteNumber", "name", "status", "siteTypeId", "siteTypeSnapshot", "currentBaseRate", "surfaceType",
  "rigType", "petFriendly", "amenities", "photos", "description", "sortOrder", "calculatedPricing",
] as const;

const ADDON_FIELDS = ["_id", "name", "description", "category", "pricingType", "price", "taxable", "icon", "sortOrder"] as const;

const RESERVATION_FIELDS = [
  "_id", "confirmationCode", "status", "checkInDate", "checkOutDate", "numNights", "adults", "children", "pets",
  "addOns", "pricing", "siteSnapshot", "specialRequests", "source", "createdAt",
] as const;

export const publicProperty = (p: unknown) => pick(p, PROPERTY_FIELDS);
export const publicSite = (s: unknown) => pick(s, SITE_FIELDS);
export const publicAddOn = (a: unknown) => pick(a, ADDON_FIELDS);
export const publicGuest = (g: unknown) => pick(g, ["_id", "firstName", "lastName", "email"]);
export const publicPayment = (p: unknown) => pick(p, ["_id", "type", "amount", "currency", "method", "status", "createdAt"]);

export function publicReservation(r: unknown) {
  const base = pick(r, RESERVATION_FIELDS);
  const snapshot = (r as Doc | null)?.guestSnapshot;
  if (base && snapshot) base.guestSnapshot = pick(snapshot, ["fullName", "email", "rvType", "rvLengthFt"]);
  return base as (Doc & { confirmationCode: string; pricing: Record<string, number> }) | null;
}
