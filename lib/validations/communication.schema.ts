import { z } from "zod";

export const BROADCAST_PRIORITIES = ["general", "event", "urgent", "weather_alert"] as const;
export const BROADCAST_RECIPIENT_FILTERS = [
  "all_guests",
  "in_house_campers",
  "upcoming_arrivals",
] as const;

export const createBroadcastSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(150, "Subject is too long"),
  message: z.string().min(1, "Message content is required").max(5000, "Message is too long"),
  priority: z.enum(BROADCAST_PRIORITIES).default("general"),
  recipientFilter: z.enum(BROADCAST_RECIPIENT_FILTERS).default("in_house_campers"),
});

export const audienceCountQuerySchema = z.object({
  recipientFilter: z.enum(BROADCAST_RECIPIENT_FILTERS).default("in_house_campers"),
});

export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;
export type AudienceCountQuery = z.infer<typeof audienceCountQuerySchema>;
