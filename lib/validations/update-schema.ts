import { z } from "zod";

/**
 * Removes `.default()` wrappers (recursively through optional/nullable/object) so a parsed
 * PATCH body contains only the keys the client actually sent.
 *
 * Why: in Zod 4, `.partial()` still applies inner defaults — `createSchema.partial().parse({rate: 70})`
 * yields `{ rate: 70, status: "available", notes: "", ... }`, silently overwriting untouched fields.
 */
function stripDefaults(schema: z.ZodType): z.ZodType {
  // A defaulted field was optional on input; keep it optional, just without the injected value.
  if (schema instanceof z.ZodDefault) return stripDefaults(schema.unwrap() as z.ZodType).optional();
  if (schema instanceof z.ZodOptional) return stripDefaults(schema.unwrap() as z.ZodType).optional();
  if (schema instanceof z.ZodNullable) return stripDefaults(schema.unwrap() as z.ZodType).nullable();
  if (schema instanceof z.ZodObject) {
    const shape: Record<string, z.ZodType> = {};
    for (const [key, value] of Object.entries(schema.shape)) shape[key] = stripDefaults(value as z.ZodType);
    return z.object(shape);
  }
  return schema;
}

/** Builds a PATCH schema from a create schema: every field optional, no defaults injected. */
export function toUpdateSchema<T extends z.ZodRawShape>(createSchema: z.ZodObject<T>) {
  return (stripDefaults(createSchema) as z.ZodObject<z.ZodRawShape>).partial() as unknown as z.ZodObject<{
    [K in keyof T]: z.ZodOptional<T[K]>;
  }>;
}
