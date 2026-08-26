export const USER_ROLES = ["owner", "manager", "staff"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SITE_CATEGORIES = ["rv_site", "tent_site", "cabin", "glamping"] as const;
export type SiteCategory = (typeof SITE_CATEGORIES)[number];

export const ELECTRIC_HOOKUPS = ["none", "20A", "30A", "50A"] as const;
export type ElectricHookup = (typeof ELECTRIC_HOOKUPS)[number];

export const RIG_TYPES = ["pull_through", "back_in", "tent"] as const;
export type RigType = (typeof RIG_TYPES)[number];

export const SURFACE_TYPES = ["concrete", "gravel", "grass", "paved", "dirt"] as const;
export type SurfaceType = (typeof SURFACE_TYPES)[number];

export const RV_TYPES = [
  "motorhome_a",
  "motorhome_b",
  "motorhome_c",
  "fifth_wheel",
  "travel_trailer",
  "truck_camper",
  "van",
  "tent",
  "other",
] as const;
export type RvType = (typeof RV_TYPES)[number];

export const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const PAYMENT_METHODS = [
  "credit_card",
  "cash",
  "check",
  "bank_transfer",
  "online",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "completed",
  "pending",
  "refunded",
  "failed",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const RESERVATION_SOURCES = [
  "online_booking",
  "phone",
  "walk_in",
  "admin",
] as const;
export type ReservationSource = (typeof RESERVATION_SOURCES)[number];
