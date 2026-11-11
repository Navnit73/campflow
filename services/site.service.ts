import mongoose from "mongoose";
import { Site, ISite } from "@/models/Site";
import { SiteType, ISiteType } from "@/models/SiteType";
import { Reservation } from "@/models/Reservation";
import { CreateSiteInput, UpdateSiteInput, CreateSiteTypeInput, UpdateSiteTypeInput } from "@/lib/validations/site.schema";
import { connectDB } from "@/lib/db/connection";
import { toDotPaths } from "@/lib/utils/flatten";

export class SiteService {
  static async listSites(organizationId: string, propertyId: string, options?: { status?: string; siteTypeId?: string }) {
    await connectDB();

    const query: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    };

    if (options?.status && options.status !== "all") {
      query.status = String(options.status);
    }

    if (options?.siteTypeId) {
      query.siteTypeId = new mongoose.Types.ObjectId(options.siteTypeId);
    }

    const sites = await Site.find(query)
      .sort({ sortOrder: 1, siteNumber: 1 })
      .lean();

    return sites;
  }

  static async getSiteById(organizationId: string, propertyId: string, siteId: string) {
    await connectDB();

    const site = await Site.findOne({
      _id: new mongoose.Types.ObjectId(siteId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    }).lean();

    if (!site) {
      const err = new Error("Site not found");
      err.name = "NotFoundError";
      throw err;
    }

    return site;
  }

  static async createSite(organizationId: string, propertyId: string, input: CreateSiteInput) {
    await connectDB();

    const siteType = await SiteType.findOne({
      _id: new mongoose.Types.ObjectId(input.siteTypeId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    }).lean();

    if (!siteType) {
      const err = new Error("Selected Site Type was not found");
      err.name = "NotFoundError";
      throw err;
    }

    const existingSite = await Site.findOne({
      propertyId: new mongoose.Types.ObjectId(propertyId),
      siteNumber: input.siteNumber.trim(),
    }).lean();

    if (existingSite) {
      const err = new Error(`A site with number "${input.siteNumber}" already exists.`);
      err.name = "ConflictError";
      throw err;
    }

    const site = await Site.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
      siteTypeId: siteType._id,
      siteNumber: input.siteNumber.trim(),
      name: input.name || `Site ${input.siteNumber}`,
      status: input.status || "available",
      siteTypeSnapshot: {
        name: siteType.name,
        category: siteType.category,
        hookups: siteType.hookups,
        maxRigLength: siteType.maxRigLength,
      },
      currentBaseRate: input.currentBaseRate !== undefined ? input.currentBaseRate : siteType.defaultBaseRate,
      weekendBaseRate: input.weekendBaseRate,
      surfaceType: input.surfaceType,
      rigType: input.rigType,
      petFriendly: input.petFriendly ?? true,
      amenities: input.amenities || [],
      photos: input.photos || [],
      description: input.description || "",
      notes: input.notes || "",
      sortOrder: input.sortOrder || 0,
    });

    return site.toObject();
  }

  static async updateSite(organizationId: string, propertyId: string, siteId: string, input: UpdateSiteInput) {
    await connectDB();

    const site = await Site.findOne({
      _id: new mongoose.Types.ObjectId(siteId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    });

    if (!site) {
      const err = new Error("Site not found");
      err.name = "NotFoundError";
      throw err;
    }

    if (input.siteNumber && input.siteNumber !== site.siteNumber) {
      const duplicate = await Site.findOne({
        propertyId: site.propertyId,
        siteNumber: input.siteNumber.trim(),
        _id: { $ne: site._id },
      }).lean();

      if (duplicate) {
        const err = new Error(`Site number "${input.siteNumber}" is already in use.`);
        err.name = "ConflictError";
        throw err;
      }
      site.siteNumber = input.siteNumber.trim();
    }

    if (input.siteTypeId && input.siteTypeId !== site.siteTypeId.toString()) {
      const siteType = await SiteType.findOne({
        _id: new mongoose.Types.ObjectId(input.siteTypeId),
        propertyId: site.propertyId,
      }).lean();

      if (!siteType) {
        const err = new Error("Selected Site Type was not found");
        err.name = "NotFoundError";
        throw err;
      }

      site.siteTypeId = siteType._id;
      site.siteTypeSnapshot = {
        name: siteType.name,
        category: siteType.category,
        hookups: siteType.hookups,
        maxRigLength: siteType.maxRigLength,
      };
    }

    if (input.name !== undefined) site.name = input.name;
    if (input.status !== undefined) site.status = input.status;
    if (input.currentBaseRate !== undefined) site.currentBaseRate = input.currentBaseRate;
    if (input.weekendBaseRate !== undefined) site.weekendBaseRate = input.weekendBaseRate;
    if (input.surfaceType !== undefined) site.surfaceType = input.surfaceType;
    if (input.rigType !== undefined) site.rigType = input.rigType;
    if (input.petFriendly !== undefined) site.petFriendly = input.petFriendly;
    if (input.amenities !== undefined) site.amenities = input.amenities;
    if (input.photos !== undefined) site.photos = input.photos;
    if (input.description !== undefined) site.description = input.description;
    if (input.notes !== undefined) site.notes = input.notes;
    if (input.sortOrder !== undefined) site.sortOrder = input.sortOrder;

    await site.save();
    return site.toObject();
  }

  static async deleteSite(organizationId: string, propertyId: string, siteId: string) {
    await connectDB();

    const activeReservations = await Reservation.countDocuments({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
      siteId: new mongoose.Types.ObjectId(siteId),
      status: { $in: ["confirmed", "checked_in", "pending"] },
      checkOutDate: { $gte: new Date() },
    });

    if (activeReservations > 0) {
      const err = new Error("Cannot delete site with active or upcoming reservations. Mark as inactive instead.");
      err.name = "ConflictError";
      throw err;
    }

    const result = await Site.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(siteId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    });

    if (!result) {
      const err = new Error("Site not found");
      err.name = "NotFoundError";
      throw err;
    }

    return { id: siteId, deleted: true };
  }

  // Site Types
  static async listSiteTypes(organizationId: string, propertyId: string) {
    await connectDB();

    const types = await SiteType.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    })
      .sort({ defaultBaseRate: 1 })
      .lean();

    return types;
  }

  static async createSiteType(organizationId: string, propertyId: string, input: CreateSiteTypeInput) {
    await connectDB();

    const siteType = await SiteType.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
      name: input.name,
      category: input.category,
      hookups: input.hookups,
      maxRigLength: input.maxRigLength,
      defaultBaseRate: input.defaultBaseRate,
      maxOccupancy: input.maxOccupancy,
      description: input.description || "",
    });

    return siteType.toObject();
  }

  static async updateSiteType(organizationId: string, propertyId: string, siteTypeId: string, input: UpdateSiteTypeInput) {
    await connectDB();

    const updated = await SiteType.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(siteTypeId),
        organizationId: new mongoose.Types.ObjectId(organizationId),
        propertyId: new mongoose.Types.ObjectId(propertyId),
      },
      { $set: toDotPaths(input) },
      { returnDocument: "after", runValidators: true }
    ).lean();

    if (!updated) {
      const err = new Error("Site Type not found");
      err.name = "NotFoundError";
      throw err;
    }

    // Update snapshots on linked sites
    await Site.updateMany(
      { siteTypeId: updated._id, propertyId: updated.propertyId },
      {
        $set: {
          "siteTypeSnapshot.name": updated.name,
          "siteTypeSnapshot.category": updated.category,
          "siteTypeSnapshot.hookups": updated.hookups,
          "siteTypeSnapshot.maxRigLength": updated.maxRigLength,
        },
      }
    );

    return updated;
  }
}
