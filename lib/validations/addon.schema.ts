import { z } from "zod";

export const ADDON_CATEGORIES = [
  "equipment",
  "merchandise",
  "utility",
  "convenience",
  "activities",
  "fees",
] as const;

export const ADDON_PRICING_TYPES = [
  "per_stay",
  "per_night",
  "per_unit",
  "per_person",
] as const;

export const createAddOnSchema = z.object({
  name: z.string().min(1, "Service name is required").max(100, "Name too long"),
  description: z.string().optional().default(""),
  category: z.enum(ADDON_CATEGORIES).default("convenience"),
  pricingType: z.enum(ADDON_PRICING_TYPES).default("per_stay"),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  taxable: z.boolean().default(true),
  isActive: z.boolean().default(true),
  icon: z.string().optional().default("sparkles"),
  sortOrder: z.coerce.number().default(0),
});

export const updateAddOnSchema = createAddOnSchema.partial();

export const queryAddOnsSchema = z.object({
  category: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
  search: z.string().optional(),
});

export type CreateAddOnInput = z.infer<typeof createAddOnSchema>;
export type UpdateAddOnInput = z.infer<typeof updateAddOnSchema>;
export type QueryAddOnsInput = z.infer<typeof queryAddOnsSchema>;
