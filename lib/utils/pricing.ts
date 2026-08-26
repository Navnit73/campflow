import { parseDateOnly, diffDays } from "@/lib/utils/date";

export interface CalculatePricingParams {
  nightlyRate: number;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  taxRatePercent?: number;
  discountType?: "percentage" | "fixed_amount";
  discountValue?: number;
  paidAmount?: number;
}

export interface PricingResult {
  numNights: number;
  nightlyRate: number;
  baseSubtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
}

export function calculatePricing(params: CalculatePricingParams): PricingResult {
  const nightlyRate = Math.max(0, Number(params.nightlyRate) || 0);

  let numNights = 1;
  try {
    const nights = diffDays(params.checkInDate, params.checkOutDate);
    numNights = Math.max(1, nights);
  } catch {
    numNights = 1;
  }

  const baseSubtotal = Number((nightlyRate * numNights).toFixed(2));

  let discountAmount = 0;
  if (params.discountType === "percentage" && params.discountValue && !isNaN(params.discountValue)) {
    discountAmount = Number(((baseSubtotal * params.discountValue) / 100).toFixed(2));
  } else if (params.discountType === "fixed_amount" && params.discountValue && !isNaN(params.discountValue)) {
    discountAmount = Number(Math.min(baseSubtotal, params.discountValue).toFixed(2));
  }

  const taxableAmount = Math.max(0, baseSubtotal - discountAmount);
  const taxRate = Math.max(0, Number(params.taxRatePercent) || 0);
  const taxAmount = Number(((taxableAmount * taxRate) / 100).toFixed(2));
  const totalAmount = Number((taxableAmount + taxAmount).toFixed(2));
  const paidAmount = Math.max(0, Number(params.paidAmount) || 0);
  const balanceDue = Number(Math.max(0, totalAmount - paidAmount).toFixed(2));

  return {
    numNights,
    nightlyRate,
    baseSubtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    totalAmount,
    paidAmount,
    balanceDue,
  };
}
