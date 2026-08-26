import { z } from "zod";
import { ELECTRIC_HOOKUPS, RIG_TYPES, SITE_CATEGORIES, SURFACE_TYPES } from "@/lib/constants";

export const createSiteTypeSchema = z.object({
  name: z.string().min(2, "Site type name is required"),
  category: z.enum(SITE_CATEGORIES).default("rv_site"),
  hookups: z.object({
    electric: z.enum(ELECTRIC_HOOKUPS).default("30A"),
    water: z.boolean().default(true),
    sewer: z.boolean().default(true),
  }),
  maxRigLength: z.coerce.number().min(0, "Max rig length must be 0 or greater").default(40),
  defaultBaseRate: z.coerce.number().min(0, "Base rate must be positive"),
  maxOccupancy: z.coerce.number().min(1, "Max occupancy must be at least 1").default(6),
  description: z.string().optional().default(""),
  photos: z.array(z.string()).optional().default([]),
});

export const updateSiteTypeSchema = createSiteTypeSchema.partial();

export const createSiteSchema = z.object({
  siteNumber: z.string().min(1, "Site number/identifier is required"),
  name: z.string().optional().default(""),
  siteTypeId: z.string().min(1, "Site type selection is required"),
  status: z.enum(["available", "maintenance", "inactive"]).default("available"),
  currentBaseRate: z.coerce.number().min(0, "Nightly rate must be positive").optional(),
  weekendBaseRate: z.coerce.number().min(0).optional(),
  surfaceType: z.enum(SURFACE_TYPES).default("gravel"),
  rigType: z.enum(RIG_TYPES).default("back_in"),
  petFriendly: z.boolean().optional().default(true),
  amenities: z.array(z.string()).optional().default([]),
  photos: z.array(z.string()).optional().default([]),
  description: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  sortOrder: z.coerce.number().optional().default(0),
});

export const updateSiteSchema = createSiteSchema.partial();

export type CreateSiteTypeInput = z.infer<typeof createSiteTypeSchema>;
export type UpdateSiteTypeInput = z.infer<typeof updateSiteTypeSchema>;
export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
