import { z } from "zod";
import { RV_TYPES } from "@/lib/constants";

export const publicAvailabilityQuerySchema = z
  .object({
    slug: z.string().min(1, "Property slug is required"),
    checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-in date must be YYYY-MM-DD"),
    checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-out date must be YYYY-MM-DD"),
    rvType: z.enum(RV_TYPES).optional().default("travel_trailer"),
    rigLengthFt: z.coerce.number().min(0).optional().default(30),
    hookupType: z.string().optional(), // 'any' | '50A' | '30A' | 'full'
    siteCategory: z.string().optional(),
    adults: z.coerce.number().min(1).default(2),
    children: z.coerce.number().min(0).default(0),
    pets: z.coerce.number().min(0).default(0),
  })
  .refine((data) => new Date(data.checkOutDate) > new Date(data.checkInDate), {
    message: "Check-out date must be strictly after check-in date",
    path: ["checkOutDate"],
  });

export const publicBookingAddOnSchema = z.object({
  addOnId: z.string().optional(),
  name: z.string().min(1, "Add-on name is required"),
  price: z.coerce.number().min(0),
  pricingType: z.enum(["per_stay", "per_night", "per_unit", "per_person"]).default("per_stay"),
  quantity: z.coerce.number().min(1).default(1),
  taxable: z.boolean().optional().default(true),
});

export const publicCreateBookingSchema = z
  .object({
    slug: z.string().min(1, "Property slug is required"),
    siteId: z.string().min(1, "Selected site ID is required"),
    checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-in date must be YYYY-MM-DD"),
    checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-out date must be YYYY-MM-DD"),
    adults: z.coerce.number().min(1).default(2),
    children: z.coerce.number().min(0).default(0),
    pets: z.coerce.number().min(0).default(0),
    addOns: z.array(publicBookingAddOnSchema).optional().default([]),
    discountCode: z.string().optional(),
    guest: z.object({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().min(1, "Last name is required"),
      email: z.string().email("Valid email address is required"),
      phone: z.string().min(7, "Valid phone number is required"),
      rvType: z.enum(RV_TYPES).default("travel_trailer"),
      rvLengthFt: z.coerce.number().min(0).default(30),
      licensePlate: z.string().optional().default(""),
    }),
    specialRequests: z.string().optional().default(""),
    paymentMethod: z.enum(["credit_card", "online"]).default("credit_card"),
  })
  .refine((data) => new Date(data.checkOutDate) > new Date(data.checkInDate), {
    message: "Check-out date must be after check-in date",
    path: ["checkOutDate"],
  });

export type PublicAvailabilityQuery = z.infer<typeof publicAvailabilityQuerySchema>;
export type PublicCreateBookingInput = z.infer<typeof publicCreateBookingSchema>;
