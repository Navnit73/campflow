/**
 * Flattens nested plain objects into MongoDB dot-path keys for $set, so a partial nested
 * update (e.g. { rvDetails: { lengthFt: 35 } }) doesn't replace the whole subdocument.
 * Arrays, Dates and ObjectIds are treated as leaf values.
 */
export function toDotPaths(input: object, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const isPlainObject =
      value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
    if (isPlainObject && Object.keys(value as object).length > 0) toDotPaths(value as object, path, out);
    else out[path] = value;
  }
  return out;
}
