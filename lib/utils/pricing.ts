import { diffDays } from "./date";

export interface AddOnPricingInput {
  addOnId?: string;
  name: string;
  price: number;
  pricingType: "per_stay" | "per_night" | "per_unit" | "per_person";
  quantity?: number;
  taxable?: boolean;
}

export interface CalculatedAddOnItem {
  addOnId?: string;
  name: string;
  price: number;
  pricingType: "per_stay" | "per_night" | "per_unit" | "per_person";
  quantity: number;
  subtotal: number;
  taxable: boolean;
}

export interface CalculatePricingParams {
  nightlyRate: number;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  adults?: number;
  taxRatePercent?: number;
  discountType?: "percentage" | "fixed_amount";
  discountValue?: number;
  paidAmount?: number;
  addOns?: AddOnPricingInput[];
}

export interface PricingResult {
  numNights: number;
  nightlyRate: number;
  baseSubtotal: number;
  addOnsSubtotal: number;
  calculatedAddOns: CalculatedAddOnItem[];
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
}

export function calculatePricing(params: CalculatePricingParams): PricingResult {
  const nightlyRate = Math.max(0, Number(params.nightlyRate) || 0);
  const adults = Math.max(1, Number(params.adults) || 2);

  let numNights = 1;
  try {
    const nights = diffDays(params.checkInDate, params.checkOutDate);
    numNights = Math.max(1, nights);
  } catch {
    numNights = 1;
  }

  const baseSubtotal = Number((nightlyRate * numNights).toFixed(2));

  // Calculate Add-Ons
  let addOnsSubtotal = 0;
  let taxableAddOnsSubtotal = 0;
  let nonTaxableAddOnsSubtotal = 0;
  const calculatedAddOns: CalculatedAddOnItem[] = [];

  if (params.addOns && Array.isArray(params.addOns)) {
    params.addOns.forEach((item) => {
      const price = Math.max(0, Number(item.price) || 0);
      const qty = Math.max(1, Number(item.quantity) || 1);
      const isTaxable = item.taxable !== false;
      let itemSubtotal = 0;

      switch (item.pricingType) {
        case "per_night":
          itemSubtotal = price * numNights * qty;
          break;
        case "per_person":
          itemSubtotal = price * adults * qty;
          break;
        case "per_unit":
        case "per_stay":
        default:
          itemSubtotal = price * qty;
          break;
      }

      itemSubtotal = Number(itemSubtotal.toFixed(2));
      addOnsSubtotal += itemSubtotal;

      if (isTaxable) {
        taxableAddOnsSubtotal += itemSubtotal;
      } else {
        nonTaxableAddOnsSubtotal += itemSubtotal;
      }

      calculatedAddOns.push({
        addOnId: item.addOnId,
        name: item.name,
        price,
        pricingType: item.pricingType || "per_stay",
        quantity: qty,
        subtotal: itemSubtotal,
        taxable: isTaxable,
      });
    });
  }

  addOnsSubtotal = Number(addOnsSubtotal.toFixed(2));
  taxableAddOnsSubtotal = Number(taxableAddOnsSubtotal.toFixed(2));
  nonTaxableAddOnsSubtotal = Number(nonTaxableAddOnsSubtotal.toFixed(2));

  // Discounts apply to lodging baseSubtotal
  let discountAmount = 0;
  if (params.discountType === "percentage" && params.discountValue && !isNaN(params.discountValue)) {
    discountAmount = Number(((baseSubtotal * params.discountValue) / 100).toFixed(2));
  } else if (params.discountType === "fixed_amount" && params.discountValue && !isNaN(params.discountValue)) {
    discountAmount = Number(Math.min(baseSubtotal, params.discountValue).toFixed(2));
  }

  const taxableLodging = Math.max(0, baseSubtotal - discountAmount);
  const totalTaxable = taxableLodging + taxableAddOnsSubtotal;

  const taxRate = Math.max(0, Number(params.taxRatePercent) || 0);
  const taxAmount = Number(((totalTaxable * taxRate) / 100).toFixed(2));

  const totalAmount = Number((totalTaxable + nonTaxableAddOnsSubtotal + taxAmount).toFixed(2));
  const paidAmount = Math.max(0, Number(params.paidAmount) || 0);
  const balanceDue = Number(Math.max(0, totalAmount - paidAmount).toFixed(2));

  return {
    numNights,
    nightlyRate,
    baseSubtotal,
    addOnsSubtotal,
    calculatedAddOns,
    discountAmount,
    taxableAmount: totalTaxable,
    taxAmount,
    totalAmount,
    paidAmount,
    balanceDue,
  };
}
