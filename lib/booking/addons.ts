import mongoose from "mongoose";
import { AddOn } from "@/models/AddOn";
import type { AddOnPricingInput } from "@/lib/utils/pricing";
import { ValidationError } from "@/lib/utils/errors";

type IncomingAddOn = {
  addOnId?: string | mongoose.Types.ObjectId | null;
  name: string;
  price: number;
  pricingType: AddOnPricingInput["pricingType"];
  quantity?: number;
  taxable?: boolean;
};

const MAX_QTY = 500;

/**
 * Resolves add-on line items for staff-created/edited reservations.
 *  - Items referencing the catalog (addOnId) take name/price/pricingType/taxable from the catalog
 *    (previously the client-sent price was trusted).
 *  - Items already on the reservation keep their booked terms (no silent re-pricing of history).
 *  - Items without addOnId are manual desk charges and keep the entered values.
 */
export async function resolveStaffAddOns(
  propertyId: string | mongoose.Types.ObjectId,
  items: IncomingAddOn[] | undefined,
  existing: IncomingAddOn[] = []
): Promise<AddOnPricingInput[]> {
  if (!items?.length) return [];

  const booked = new Map(existing.filter((e) => e.addOnId).map((e) => [String(e.addOnId), e]));
  const needCatalog = items
    .filter((i) => i.addOnId && !booked.has(String(i.addOnId)))
    .map((i) => String(i.addOnId));

  if (needCatalog.some((id) => !mongoose.isValidObjectId(id))) {
    throw new ValidationError("Unknown service in add-ons", { addOns: "Unknown add-on" });
  }
  const catalog = needCatalog.length
    ? await AddOn.find({ _id: { $in: needCatalog }, propertyId: new mongoose.Types.ObjectId(propertyId) })
        .select("name price pricingType taxable")
        .lean()
    : [];
  const byId = new Map(catalog.map((c) => [c._id.toString(), c]));

  return items.map((item) => {
    const quantity = Math.min(MAX_QTY, Math.max(1, Math.floor(Number(item.quantity) || 1)));
    if (!item.addOnId) {
      return { name: item.name, price: Math.max(0, Number(item.price) || 0), pricingType: item.pricingType, taxable: item.taxable !== false, quantity };
    }
    const id = String(item.addOnId);
    const source = booked.get(id) || byId.get(id);
    if (!source) throw new ValidationError("A selected service doesn't exist for this property", { addOns: "Unknown add-on" });
    return { addOnId: id, name: source.name, price: source.price, pricingType: source.pricingType, taxable: source.taxable !== false, quantity };
  });
}
