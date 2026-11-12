import mongoose from "mongoose";
import { Guest, IGuest } from "@/models/Guest";
import { Reservation } from "@/models/Reservation";
import { CreateGuestInput, UpdateGuestInput, QueryGuestsInput } from "@/lib/validations/guest.schema";
import { connectDB } from "@/lib/db/connection";
import { invalidateProperty } from "@/lib/cache";
import { toDotPaths } from "@/lib/utils/flatten";
import { searchRegex } from "@/lib/utils/regex";
import { tokenFilter } from "@/lib/search/tokens";
import { paginate, SEARCH_MAX_TIME_MS } from "@/lib/utils/pagination";
import { ConflictError } from "@/lib/utils/errors";

export class GuestService {
  static async listGuests(organizationId: string, propertyId: string, options: QueryGuestsInput) {
    await connectDB();

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    };

    if (options.search && options.search.trim()) {
      const tokens = tokenFilter(options.search);
      const legacy = await Guest.exists({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        propertyId: new mongoose.Types.ObjectId(propertyId),
        searchTokens: null,
      });
      if (tokens && !legacy) {
        Object.assign(query, tokens);
      } else {
        // Pre-token records: unindexed substring scan until the backfill migration has run.
        const rx = searchRegex(options.search);
        query.$or = [
          { firstName: rx },
          { lastName: rx },
          { email: rx },
          { phone: rx },
          { "rvDetails.licensePlate": rx },
        ];
      }
    }

    const isSearch = Boolean(options.search && options.search.trim());
    const [guests, pagination] = await Promise.all([
      Guest.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .maxTimeMS(isSearch ? SEARCH_MAX_TIME_MS : 0)
        .lean(),
      paginate(Guest, query, page, limit, isSearch),
    ]);

    return { guests, pagination };
  }

  static async getGuestById(organizationId: string, propertyId: string, guestId: string) {
    await connectDB();

    const guest = await Guest.findOne({
      _id: new mongoose.Types.ObjectId(guestId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    }).lean();

    if (!guest) {
      const err = new Error("Guest not found");
      err.name = "NotFoundError";
      throw err;
    }

    // Get reservation history
    const reservations = await Reservation.find({
      guestId: guest._id,
      propertyId: new mongoose.Types.ObjectId(propertyId),
    })
      .sort({ checkInDate: -1 })
      .limit(200)
      .lean();

    return {
      guest,
      reservations,
    };
  }

  static async createGuest(organizationId: string, propertyId: string, input: CreateGuestInput) {
    await connectDB();

    // Check if guest with same email exists in org
    const existing = await Guest.findOne({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      email: input.email.toLowerCase().trim(),
    }).lean();

    if (existing) {
      const err = new Error("A guest with this email address already exists.");
      err.name = "ConflictError";
      throw err;
    }

    const guest = await Guest.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.toLowerCase().trim(),
      phone: input.phone.trim(),
      address: input.address,
      rvDetails: input.rvDetails,
      notes: input.notes || "",
      isVip: input.isVip || false,
    });

    await invalidateProperty(propertyId);
    return guest.toObject();
  }

  static async updateGuest(organizationId: string, propertyId: string, guestId: string, input: UpdateGuestInput) {
    await connectDB();

    if (input.email !== undefined) {
      input = { ...input, email: input.email.toLowerCase().trim() };
      const clash = await Guest.exists({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        email: input.email,
        _id: { $ne: new mongoose.Types.ObjectId(guestId) },
      });
      if (clash) throw new ConflictError("Another guest already uses this email address.");
    }

    const guest = await Guest.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(guestId),
        organizationId: new mongoose.Types.ObjectId(organizationId),
        propertyId: new mongoose.Types.ObjectId(propertyId),
      },
      { $set: toDotPaths(input) },
      { returnDocument: "after", runValidators: true }
    ).lean();

    if (!guest) {
      const err = new Error("Guest not found");
      err.name = "NotFoundError";
      throw err;
    }

    await invalidateProperty(propertyId);
    return guest;
  }
}
