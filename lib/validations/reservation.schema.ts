import { z } from "zod";
import { RESERVATION_SOURCES, RESERVATION_STATUSES, RV_TYPES } from "@/lib/constants";

export const inlineGuestSchema = z.object({
  firstName: z.string().min(1, "Guest first name is required"),
  lastName: z.string().min(1, "Guest last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(7, "Valid phone number is required"),
  rvType: z.enum(RV_TYPES).optional().default("travel_trailer"),
  rvLengthFt: z.coerce.number().min(0).optional().default(30),
  licensePlate: z.string().optional().default(""),
});

export const createReservationSchema = z
  .object({
    siteId: z.string().min(1, "Site is required"),
    guestId: z.string().optional(),
    guest: inlineGuestSchema.optional(),
    checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
    checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
    adults: z.coerce.number().min(1).default(2),
    children: z.coerce.number().min(0).default(0),
    pets: z.coerce.number().min(0).default(0),
    discountCode: z.string().optional(),
    status: z.enum(RESERVATION_STATUSES).default("confirmed"),
    source: z.enum(RESERVATION_SOURCES).default("admin"),
    specialRequests: z.string().optional().default(""),
    notes: z.string().optional().default(""),
    initialPayment: z
      .object({
        amount: z.coerce.number().min(0),
        method: z.enum(["credit_card", "cash", "check", "bank_transfer", "online"]),
        notes: z.string().optional(),
      })
      .optional(),
  })
  .refine((data) => data.guestId || data.guest, {
    message: "Either an existing guestId or guest details must be provided",
    path: ["guestId"],
  })
  .refine((data) => new Date(data.checkOutDate) > new Date(data.checkInDate), {
    message: "Check-out date must be after check-in date",
    path: ["checkOutDate"],
  });

export const updateReservationSchema = z.object({
  siteId: z.string().optional(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD").optional(),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD").optional(),
  adults: z.coerce.number().min(1).optional(),
  children: z.coerce.number().min(0).optional(),
  pets: z.coerce.number().min(0).optional(),
  status: z.enum(RESERVATION_STATUSES).optional(),
  specialRequests: z.string().optional(),
  notes: z.string().optional(),
});

export const queryReservationsSchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  siteId: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const tapeChartQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  days: z.coerce.number().min(1).max(60).default(14),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type QueryReservationsInput = z.infer<typeof queryReservationsSchema>;
export type TapeChartQueryInput = z.infer<typeof tapeChartQuerySchema>;
