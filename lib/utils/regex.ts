/** Escapes user input so it is matched literally inside a MongoDB $regex (prevents regex injection / ReDoS). */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Builds a case-insensitive literal "contains" regex from untrusted search text (length-capped). */
export function searchRegex(input: string, maxLength = 100): { $regex: string; $options: string } {
  return { $regex: escapeRegex(input.trim().slice(0, maxLength)), $options: "i" };
}
