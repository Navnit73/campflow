import { diffDays, parseDateOnly } from "./date";

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
  /** Rate for Friday and Saturday nights (site.weekendBaseRate). Ignored when not set / not > 0. */
  weekendRate?: number | null;
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
  /** Nights billed at the weekend rate (Fri/Sat). */
  weekendNights: number;
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

  // Friday and Saturday nights use the weekend rate when one is configured (it used to be ignored).
  const weekendRate = Math.max(0, Number(params.weekendRate) || 0);
  let weekendNights = 0;
  if (weekendRate > 0) {
    const start = parseDateOnly(params.checkInDate);
    for (let i = 0; i < numNights; i++) {
      const dow = new Date(start.getTime() + i * 86_400_000).getUTCDay();
      if (dow === 5 || dow === 6) weekendNights++;
    }
  }
  const baseSubtotal = Number((nightlyRate * (numNights - weekendNights) + weekendRate * weekendNights).toFixed(2));

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
    const pct = Math.min(100, Math.max(0, params.discountValue));
    discountAmount = Number(((baseSubtotal * pct) / 100).toFixed(2));
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
    weekendNights,
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
