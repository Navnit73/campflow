import { z } from "zod";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";

export const createPaymentSchema = z.object({
  reservationId: z.string().min(1, "Reservation ID is required"),
  amount: z.coerce.number().min(0.01, "Payment amount must be greater than 0"),
  type: z.enum(["payment", "refund"]).default("payment"),
  method: z.enum(PAYMENT_METHODS).default("credit_card"),
  status: z.enum(PAYMENT_STATUSES).default("completed"),
  transactionReference: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export const queryPaymentsSchema = z.object({
  reservationId: z.string().optional(),
  method: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type QueryPaymentsInput = z.infer<typeof queryPaymentsSchema>;
