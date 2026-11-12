import { z } from "zod";

/** Owner-chosen starter items. The price is always entered by the owner (templates carry none). */
const templatePick = z.object({
  key: z.string().min(1).max(60),
  price: z.coerce.number().min(0, "Price can't be negative").max(100_000),
});

export const addOnTemplatesSchema = z.object({ items: z.array(templatePick).min(1, "Choose at least one service").max(50) });
export const siteCategoryTemplatesSchema = z.object({ items: z.array(templatePick).min(1, "Choose at least one category").max(20) });

export type TemplatePick = z.infer<typeof templatePick>;
