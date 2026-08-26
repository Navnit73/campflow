import mongoose from "mongoose";
import { AddOn, IAddOn, AddOnCategory, AddOnPricingType } from "@/models/AddOn";
import { CreateAddOnInput, UpdateAddOnInput, QueryAddOnsInput } from "@/lib/validations/addon.schema";
import { connectDB } from "@/lib/db/connection";

const DEFAULT_ADDONS = [
  {
    name: "Firewood Bundle (Kiln-Dried)",
    description: "1 cu. ft. seasoned hardwood bundle with kindling & firestarter.",
    category: "merchandise" as AddOnCategory,
    pricingType: "per_unit" as AddOnPricingType,
    price: 8.5,
    taxable: true,
    icon: "flame",
    sortOrder: 1,
  },
  {
    name: "Propane Refill (20 lb Tank)",
    description: "Complete exchange/refill for standard 20lb BBQ / RV propane cylinder.",
    category: "utility" as AddOnCategory,
    pricingType: "per_unit" as AddOnPricingType,
    price: 24.0,
    taxable: true,
    icon: "zap",
    sortOrder: 2,
  },
  {
    name: "Golf Cart 4-Seater (Daily)",
    description: "Electric 4-passenger golf cart for easy campground cruising.",
    category: "equipment" as AddOnCategory,
    pricingType: "per_night" as AddOnPricingType,
    price: 45.0,
    taxable: true,
    icon: "truck",
    sortOrder: 3,
  },
  {
    name: "Late Check-Out (2:00 PM)",
    description: "Extend your departure time to 2:00 PM (subject to next site arrival).",
    category: "convenience" as AddOnCategory,
    pricingType: "per_stay" as AddOnPricingType,
    price: 25.0,
    taxable: false,
    icon: "clock",
    sortOrder: 4,
  },
  {
    name: "Pet Cleaning & Welcome Package",
    description: "Covers dog park access, waste bag dispenser, and post-stay site cleanup.",
    category: "fees" as AddOnCategory,
    pricingType: "per_stay" as AddOnPricingType,
    price: 15.0,
    taxable: false,
    icon: "sparkles",
    sortOrder: 5,
  },
  {
    name: "High-Speed WiFi VIP Pass",
    description: "Dedicated 100Mbps streaming & work connection for up to 5 devices.",
    category: "utility" as AddOnCategory,
    pricingType: "per_night" as AddOnPricingType,
    price: 6.0,
    taxable: true,
    icon: "wifi",
    sortOrder: 6,
  },
  {
    name: "Kayak & Lifejacket Rental (Half-Day)",
    description: "Single or tandem kayak rental with paddle and USCG approved lifejacket.",
    category: "activities" as AddOnCategory,
    pricingType: "per_unit" as AddOnPricingType,
    price: 30.0,
    taxable: true,
    icon: "package",
    sortOrder: 7,
  },
];

export class AddOnService {
  static async getAddOns(organizationId: string, propertyId: string, query?: QueryAddOnsInput) {
    await connectDB();

    const filter: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    };

    if (query?.category && query.category !== "all") {
      filter.category = query.category;
    }

    if (query?.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    if (query?.search && query.search.trim()) {
      filter.name = { $regex: query.search.trim(), $options: "i" };
    }

    return AddOn.find(filter).sort({ sortOrder: 1, createdAt: 1 }).lean();
  }

  static async getAddOnById(organizationId: string, propertyId: string, id: string) {
    await connectDB();

    const addOn = await AddOn.findOne({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    }).lean();

    if (!addOn) {
      const err = new Error("Service / Add-on not found");
      err.name = "NotFoundError";
      throw err;
    }

    return addOn;
  }

  static async createAddOn(
    organizationId: string,
    propertyId: string,
    input: CreateAddOnInput
  ) {
    await connectDB();

    const addOn = await AddOn.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
      ...input,
    });

    return addOn.toObject();
  }

  static async updateAddOn(
    organizationId: string,
    propertyId: string,
    id: string,
    input: UpdateAddOnInput
  ) {
    await connectDB();

    const addOn = await AddOn.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        organizationId: new mongoose.Types.ObjectId(organizationId),
        propertyId: new mongoose.Types.ObjectId(propertyId),
      },
      { $set: input },
      { new: true }
    ).lean();

    if (!addOn) {
      const err = new Error("Service / Add-on not found");
      err.name = "NotFoundError";
      throw err;
    }

    return addOn;
  }

  static async deleteAddOn(organizationId: string, propertyId: string, id: string) {
    await connectDB();

    const result = await AddOn.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    });

    if (!result) {
      const err = new Error("Service / Add-on not found");
      err.name = "NotFoundError";
      throw err;
    }

    return { success: true };
  }

  static async seedDefaultAddOns(organizationId: string, propertyId: string) {
    await connectDB();

    const count = await AddOn.countDocuments({
      propertyId: new mongoose.Types.ObjectId(propertyId),
    });

    if (count > 0) {
      return { seeded: 0, message: "Add-ons already exist for this property" };
    }

    const docs = DEFAULT_ADDONS.map((addon) => ({
      ...addon,
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    }));

    const inserted = await AddOn.insertMany(docs);
    return { seeded: inserted.length, message: "Standard add-ons created successfully" };
  }
}
