/**
 * Optional starter templates for new parks.
 *
 * Templates describe WHAT an item is (name, hookups, pricing model…) but never its price:
 * the owner enters every rate/price when choosing a template, so no invented numbers are
 * ever saved. Safe to import on the client (plain data, no secrets).
 */

export interface AddOnTemplate {
  key: string;
  name: string;
  description: string;
  category: "equipment" | "merchandise" | "utility" | "convenience" | "activities" | "fees";
  pricingType: "per_stay" | "per_night" | "per_unit" | "per_person";
  taxable: boolean;
  icon: string;
}

export interface SiteCategoryTemplate {
  key: string;
  name: string;
  description: string;
  category: "rv_site" | "tent_site" | "cabin" | "glamping";
  hookups: { electric: "none" | "20A" | "30A" | "50A"; water: boolean; sewer: boolean };
  maxRigLength: number;
  maxOccupancy: number;
}

export const ADDON_TEMPLATES: AddOnTemplate[] = [
  { key: "firewood", name: "Firewood Bundle", description: "Seasoned firewood bundle.", category: "merchandise", pricingType: "per_unit", taxable: true, icon: "flame" },
  { key: "propane", name: "Propane Refill (20 lb)", description: "Refill or exchange of a standard 20 lb cylinder.", category: "utility", pricingType: "per_unit", taxable: true, icon: "zap" },
  { key: "golf-cart", name: "Golf Cart Rental", description: "Golf cart for getting around the park.", category: "equipment", pricingType: "per_night", taxable: true, icon: "truck" },
  { key: "late-checkout", name: "Late Check-Out", description: "Extended departure time, subject to availability.", category: "convenience", pricingType: "per_stay", taxable: false, icon: "clock" },
  { key: "early-checkin", name: "Early Check-In", description: "Earlier arrival time, subject to availability.", category: "convenience", pricingType: "per_stay", taxable: false, icon: "clock" },
  { key: "pet-fee", name: "Pet Fee", description: "Per-stay fee for guests travelling with pets.", category: "fees", pricingType: "per_stay", taxable: false, icon: "sparkles" },
  { key: "extra-vehicle", name: "Extra Vehicle", description: "Additional vehicle parked at the site.", category: "fees", pricingType: "per_night", taxable: true, icon: "truck" },
  { key: "wifi", name: "Premium Wi-Fi", description: "Upgraded internet access.", category: "utility", pricingType: "per_night", taxable: true, icon: "wifi" },
  { key: "kayak", name: "Kayak Rental", description: "Kayak with paddle and life jacket.", category: "activities", pricingType: "per_unit", taxable: true, icon: "package" },
];

export const SITE_CATEGORY_TEMPLATES: SiteCategoryTemplate[] = [
  { key: "rv-50a-full-pull", name: "50 Amp Full Hookup Pull-Through", description: "Pull-through RV site with 50A power, water and sewer.", category: "rv_site", hookups: { electric: "50A", water: true, sewer: true }, maxRigLength: 45, maxOccupancy: 6 },
  { key: "rv-30a-full-back", name: "30 Amp Full Hookup Back-In", description: "Back-in RV site with 30A power, water and sewer.", category: "rv_site", hookups: { electric: "30A", water: true, sewer: true }, maxRigLength: 35, maxOccupancy: 6 },
  { key: "rv-water-electric", name: "Water & Electric RV Site", description: "RV site with 30A power and water (dump station on site).", category: "rv_site", hookups: { electric: "30A", water: true, sewer: false }, maxRigLength: 35, maxOccupancy: 6 },
  { key: "tent", name: "Tent Site", description: "Tent or pop-up site.", category: "tent_site", hookups: { electric: "none", water: false, sewer: false }, maxRigLength: 0, maxOccupancy: 4 },
  { key: "cabin", name: "Cabin", description: "Cabin rental.", category: "cabin", hookups: { electric: "none", water: false, sewer: false }, maxRigLength: 0, maxOccupancy: 4 },
];

export const addOnTemplateByKey = new Map(ADDON_TEMPLATES.map((t) => [t.key, t]));
export const siteCategoryTemplateByKey = new Map(SITE_CATEGORY_TEMPLATES.map((t) => [t.key, t]));
