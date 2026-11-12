import mongoose from "mongoose";
import { AddOn } from "@/models/AddOn";
import { CreateAddOnInput, UpdateAddOnInput, QueryAddOnsInput } from "@/lib/validations/addon.schema";
import { connectDB } from "@/lib/db/connection";
import { addOnTemplateByKey } from "@/lib/onboarding/templates";
import type { TemplatePick } from "@/lib/validations/templates.schema";
import { ValidationError } from "@/lib/utils/errors";
import { invalidateProperty } from "@/lib/cache";
import { searchRegex } from "@/lib/utils/regex";

export class AddOnService {
  static async getAddOns(organizationId: string, propertyId: string, query?: QueryAddOnsInput) {
    await connectDB();

    const filter: Record<string, any> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      propertyId: new mongoose.Types.ObjectId(propertyId),
    };

    if (query?.category && query.category !== "all") {
      filter.category = String(query.category);
    }

    if (query?.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    if (query?.search && query.search.trim()) {
      filter.name = searchRegex(query.search);
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

    await invalidateProperty(propertyId);
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
      { returnDocument: "after" }
    ).lean();

    if (!addOn) {
      const err = new Error("Service / Add-on not found");
      err.name = "NotFoundError";
      throw err;
    }

    await invalidateProperty(propertyId);
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

    await invalidateProperty(propertyId);
    return { success: true };
  }

  /**
   * Creates add-ons from starter templates with owner-entered prices (previously a fixed catalog
   * with example prices was inserted). Items whose name already exists in the property are skipped.
   */
  static async createFromTemplates(organizationId: string, propertyId: string, items: TemplatePick[]) {
    await connectDB();
    const unknown = items.filter((i) => !addOnTemplateByKey.has(i.key)).map((i) => i.key);
    if (unknown.length) throw new ValidationError(`Unknown service template: ${unknown.join(", ")}`);

    const propId = new mongoose.Types.ObjectId(propertyId);
    const existing = new Set(
      (await AddOn.find({ propertyId: propId }).select("name").lean()).map((a) => a.name.toLowerCase())
    );
    const maxSort = (await AddOn.findOne({ propertyId: propId }).sort({ sortOrder: -1 }).select("sortOrder").lean())?.sortOrder ?? 0;

    const docs = items
      .map((item) => ({ item, template: addOnTemplateByKey.get(item.key)! }))
      .filter(({ template }) => !existing.has(template.name.toLowerCase()))
      .map(({ item, template }, i) => ({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        propertyId: propId,
        name: template.name,
        description: template.description,
        category: template.category,
        pricingType: template.pricingType,
        taxable: template.taxable,
        icon: template.icon,
        price: item.price,
        isActive: true,
        sortOrder: maxSort + i + 1,
      }));

    const inserted = docs.length ? await AddOn.insertMany(docs) : [];
    if (inserted.length) await invalidateProperty(propertyId);
    return { created: inserted.length, skipped: items.length - inserted.length };
  }
}
