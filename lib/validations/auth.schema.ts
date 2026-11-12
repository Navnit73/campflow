import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  organizationName: z.string().min(2, "Park / Organization name must be at least 2 characters"),
  propertyName: z.string().min(2, "Property name must be at least 2 characters").optional(),
  phone: z.string().min(7, "Phone number is required"),
  /** IANA timezone from the registering browser (e.g. "America/Denver"); editable later in Settings. */
  timezone: z
    .string()
    .max(64)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone")
    .optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
