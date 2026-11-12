import mongoose from "mongoose";
import { Property } from "@/models/Property";
import { Site } from "@/models/Site";
import { SiteType } from "@/models/SiteType";
import { AddOn } from "@/models/AddOn";
import { connectDB } from "@/lib/db/connection";
import { invalidate, invalidateProperty } from "@/lib/cache";
import { NotFoundError } from "@/lib/utils/errors";
import { toDotPaths } from "@/lib/utils/flatten";
import type { UpdatePropertyInput } from "@/lib/validations/property.schema";

const SETTINGS_FIELDS =
  "name slug description phone email address timezone currency checkInTime checkOutTime taxRatePercent quietHours bookingPolicy settingsConfirmedAt";

export interface SetupStep {
  key: "address" | "operations" | "policy" | "categories" | "sites" | "services" | "booking";
  title: string;
  detail: string;
  done: boolean;
  optional: boolean;
  href: string;
}

export class PropertyService {
  /**
   * Owner onboarding checklist, computed from real data (nothing is assumed complete).
   * "operations" covers the defaulted check-in/out times and tax rate: it's only done once the
   * owner has reviewed and saved Settings.
   */
  static async getSetupStatus(organizationId: string, propertyId: string) {
    await connectDB();
    const propId = new mongoose.Types.ObjectId(propertyId);
    const [property, categories, sites, availableSites, services] = await Promise.all([
      this.getProperty(organizationId, propertyId),
      SiteType.countDocuments({ propertyId: propId }),
      Site.countDocuments({ propertyId: propId }),
      Site.countDocuments({ propertyId: propId, status: "available" }),
      AddOn.countDocuments({ propertyId: propId }),
    ]);

    const a = property.address || ({} as { street?: string; city?: string });
    const ready = Boolean(a.street && a.city) && Boolean(property.settingsConfirmedAt) && availableSites > 0;
    const steps: SetupStep[] = [
      {
        key: "address",
        title: "Add your park address",
        detail: "Shown to guests on the booking page, confirmation and emails.",
        done: Boolean(a.street && a.city),
        optional: false,
        href: "/settings",
      },
      {
        key: "operations",
        title: "Confirm tax rate and check-in/out times",
        detail: `Currently: tax ${property.taxRatePercent ?? 0}% · check-in ${property.checkInTime} · check-out ${property.checkOutTime}${property.settingsConfirmedAt ? "" : " (defaults — not yet confirmed)"}.`,
        done: Boolean(property.settingsConfirmedAt),
        optional: false,
        href: "/settings",
      },
      {
        key: "policy",
        title: "Write your cancellation policy",
        detail: "Shown to guests before they book.",
        done: Boolean(property.bookingPolicy && property.bookingPolicy.trim()),
        optional: true,
        href: "/settings",
      },
      {
        key: "categories",
        title: "Create site categories",
        detail: categories ? `${categories} categor${categories === 1 ? "y" : "ies"}` : "Hookups, rig length, occupancy and nightly rate for each kind of site.",
        done: categories > 0,
        optional: false,
        href: "/sites",
      },
      {
        key: "sites",
        title: "Add your sites",
        detail: sites ? `${sites} site${sites === 1 ? "" : "s"} (${availableSites} bookable)` : "Each bookable site with its number and rate.",
        done: availableSites > 0,
        optional: false,
        href: "/sites",
      },
      {
        key: "services",
        title: "Add services and fees",
        detail: services ? `${services} service${services === 1 ? "" : "s"}` : "Firewood, pet fees, rentals… (optional)",
        done: services > 0,
        optional: true,
        href: "/services",
      },
      {
        key: "booking",
        title: "Share your online booking page",
        detail: ready ? `/book/${property.slug}` : "Available once the required steps above are done.",
        done: ready,
        optional: false,
        href: `/book/${property.slug}`,
      },
    ];
    const required = steps.filter((s) => !s.optional);
    return {
      slug: property.slug,
      readyForBookings: ready,
      completed: steps.filter((s) => s.done).length,
      total: steps.length,
      requiredRemaining: required.filter((s) => !s.done).length,
      steps,
    };
  }

  static async getProperty(organizationId: string, propertyId: string) {
    await connectDB();
    const property = await Property.findOne({
      _id: new mongoose.Types.ObjectId(propertyId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
    })
      .select(SETTINGS_FIELDS)
      .lean();
    if (!property) throw new NotFoundError("Property not found");
    return property;
  }

  /**
   * Updates park settings. Previously the Settings page only showed a success toast and saved nothing.
   * Tax-rate changes apply to new bookings; existing reservations keep the rate frozen at booking time.
   */
  static async updateProperty(organizationId: string, propertyId: string, input: UpdatePropertyInput) {
    await connectDB();
    const updated = await Property.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(propertyId), organizationId: new mongoose.Types.ObjectId(organizationId) },
      { $set: { ...toDotPaths(input), settingsConfirmedAt: new Date() } },
      { returnDocument: "after", runValidators: true, projection: SETTINGS_FIELDS }
    ).lean();
    if (!updated) throw new NotFoundError("Property not found");
    // Dashboard/reports (timezone, tax) and the public profile served by slug.
    await Promise.all([invalidateProperty(propertyId), invalidate(`slug:${updated.slug}`)]);
    return updated;
  }
}
