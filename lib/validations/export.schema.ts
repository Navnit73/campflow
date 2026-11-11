import { z } from "zod";
import { toUpdateSchema } from "./update-schema";

export const EXPORT_REPORT_TYPES = [
  "excel_master_accounting",
  "excel_bookings",
  "excel_transactions",
  "excel_invoices",
  "excel_customers",
] as const;

export const createOnDemandExportSchema = z.object({
  type: z.enum(EXPORT_REPORT_TYPES).default("excel_master_accounting"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  preset: z.string().optional(),
  status: z.string().optional(),
  paymentMethod: z.string().optional(),
  category: z.string().optional(),
});

export type CreateOnDemandExportInput = z.infer<typeof createOnDemandExportSchema>;

export const createScheduleSchema = z.object({
  name: z.string().min(2, "Schedule name is required").max(100),
  type: z.enum(EXPORT_REPORT_TYPES).default("excel_master_accounting"),
  frequency: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:mm 24-hr format (e.g. 08:00)"),
  recipients: z
    .array(z.string().email("Invalid email address"))
    .min(1, "At least one recipient email is required"),
  filters: z
    .object({
      status: z.string().optional(),
      paymentMethod: z.string().optional(),
      category: z.string().optional(),
    })
    .optional(),
  isActive: z.boolean().default(true),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

export const updateScheduleSchema = toUpdateSchema(createScheduleSchema);
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

export const queryHistorySchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type QueryHistoryInput = z.infer<typeof queryHistorySchema>;
