import mongoose from "mongoose";
import { Discount } from "@/models/Discount";
import { ValidationError } from "@/lib/utils/errors";

export interface ResolvedDiscount {
  _id: mongoose.Types.ObjectId;
  code: string;
  type: "percentage" | "fixed_amount";
  value: number;
}

/**
 * Resolves a discount code for a property, enforcing isActive and the validity window.
 * Throws a ValidationError for unknown/expired codes instead of silently ignoring them
 * (previously the guest believed a discount applied when it did not).
 */
export async function resolveDiscountCode(
  propertyId: string | mongoose.Types.ObjectId,
  code: string,
  onDate: Date = new Date()
): Promise<ResolvedDiscount> {
  const doc = await Discount.findOne({
    propertyId: new mongoose.Types.ObjectId(propertyId),
    code: code.toUpperCase().trim(),
    isActive: true,
  })
    .select("code type value validFrom validUntil")
    .lean();

  const invalid = () =>
    new ValidationError("Discount code is invalid or has expired", { discountCode: "Invalid or expired code" });

  if (!doc) throw invalid();
  if (doc.validFrom && onDate < doc.validFrom) throw invalid();
  if (doc.validUntil && onDate > doc.validUntil) throw invalid();

  return {
    _id: doc._id,
    code: doc.code,
    type: doc.type,
    value: doc.type === "percentage" ? Math.min(100, Math.max(0, doc.value)) : Math.max(0, doc.value),
  };
}
