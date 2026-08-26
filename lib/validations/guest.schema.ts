import { z } from "zod";
import { RV_TYPES } from "@/lib/constants";

export const createGuestSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(7, "Valid phone number is required"),
  address: z
    .object({
      street: z.string().optional().default(""),
      city: z.string().optional().default(""),
      state: z.string().optional().default(""),
      zip: z.string().optional().default(""),
      country: z.string().optional().default("USA"),
    })
    .optional(),
  rvDetails: z
    .object({
      type: z.enum(RV_TYPES).default("travel_trailer"),
      lengthFt: z.coerce.number().min(0).default(30),
      licensePlate: z.string().optional().default(""),
      state: z.string().optional().default(""),
      makeModel: z.string().optional().default(""),
    })
    .optional(),
  notes: z.string().optional().default(""),
  isVip: z.boolean().optional().default(false),
});

export const updateGuestSchema = createGuestSchema.partial();

export const queryGuestsSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type QueryGuestsInput = z.infer<typeof queryGuestsSchema>;
