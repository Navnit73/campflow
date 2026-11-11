import { Organization } from "@/models/Organization";
import { Property } from "@/models/Property";
import { SiteType } from "@/models/SiteType";
import { Site } from "@/models/Site";
import { AddOn } from "@/models/AddOn";

let counter = 0;

export async function seedTenant(overrides: { taxRatePercent?: number; timezone?: string } = {}) {
  const n = ++counter;
  const org = await Organization.create({ name: `Org ${n}`, slug: `org-${n}-${Date.now()}` });
  const property = await Property.create({
    organizationId: org._id,
    name: `Park ${n}`,
    slug: `park-${n}-${Date.now()}`,
    address: { street: "1 Main", city: "Town", state: "CO", zip: "80000" },
    phone: "5550001111",
    email: `park${n}@example.com`,
    taxRatePercent: overrides.taxRatePercent ?? 10,
    timezone: overrides.timezone ?? "America/Denver",
  });
  const siteType = await SiteType.create({
    organizationId: org._id,
    propertyId: property._id,
    name: "Full Hookup",
    category: "rv_site",
    hookups: { electric: "50A", water: true, sewer: true },
    maxRigLength: 40,
    defaultBaseRate: 50,
    maxOccupancy: 6,
  });
  const site = await createSite(org._id, property._id, siteType, "A1");
  const site2 = await createSite(org._id, property._id, siteType, "A2");
  const addOn = await AddOn.create({
    organizationId: org._id,
    propertyId: property._id,
    name: "Golf Cart",
    category: "equipment",
    pricingType: "per_night",
    price: 45,
    taxable: true,
  });
  return {
    org,
    property,
    siteType,
    site,
    site2,
    addOn,
    orgId: org._id.toString(),
    propertyId: property._id.toString(),
  };
}

export async function createSite(orgId: any, propertyId: any, siteType: any, siteNumber: string) {
  return Site.create({
    organizationId: orgId,
    propertyId,
    siteTypeId: siteType._id,
    siteNumber,
    siteTypeSnapshot: {
      name: siteType.name,
      category: siteType.category,
      hookups: siteType.hookups,
      maxRigLength: siteType.maxRigLength,
    },
    currentBaseRate: 50,
  });
}

export const guestInput = (email = "camper@example.com") => ({
  firstName: "Casey",
  lastName: "Camper",
  email,
  phone: "5551234567",
  rvType: "travel_trailer" as const,
  rvLengthFt: 30,
  licensePlate: "",
});
