import mongoose from "mongoose";
import { Guest, IGuest } from "@/models/Guest";
import { Reservation } from "@/models/Reservation";
import { CreateGuestInput, UpdateGuestInput, QueryGuestsInput } from "@/lib/validations/guest.schema";
import { connectDB } from "@/lib/db/connection";

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
      const search = options.search.trim();
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { "rvDetails.licensePlate": { $regex: search, $options: "i" } },
      ];
    }

    const [guests, total] = await Promise.all([
      Guest.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Guest.countDocuments(query),
    ]);

    return {
      guests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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

    return guest.toObject();
  }

  static async updateGuest(organizationId: string, propertyId: string, guestId: string, input: UpdateGuestInput) {
    await connectDB();

    const guest = await Guest.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(guestId),
        organizationId: new mongoose.Types.ObjectId(organizationId),
        propertyId: new mongoose.Types.ObjectId(propertyId),
      },
      { $set: input },
      { new: true }
    ).lean();

    if (!guest) {
      const err = new Error("Guest not found");
      err.name = "NotFoundError";
      throw err;
    }

    return guest;
  }
}
