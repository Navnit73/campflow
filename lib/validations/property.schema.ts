import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use 24-hour HH:mm");
const timezone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Unknown timezone (use an IANA name such as America/Denver)");

/** PATCH /api/property — every field optional, no defaults injected (see audit H1). */
export const updatePropertySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().max(2000),
    phone: z.string().trim().min(7).max(30),
    email: z.string().trim().email(),
    address: z
      .object({
        street: z.string().trim().max(200),
        city: z.string().trim().max(100),
        state: z.string().trim().max(100),
        zip: z.string().trim().max(20),
        country: z.string().trim().max(60),
      })
      .partial(),
    timezone,
    checkInTime: time,
    checkOutTime: time,
    taxRatePercent: z.coerce.number().min(0).max(100),
    quietHours: z.string().max(100),
    bookingPolicy: z.string().max(2000),
  })
  .partial()
  .strict();

export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
