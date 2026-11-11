import type { Model } from "mongoose";

/** Searches with more matches than this report "1,000+" instead of counting every match. */
export const SEARCH_COUNT_CAP = 1_000;
/** Upper bound on server time for free-text search queries (unindexable substring regex). */
export const SEARCH_MAX_TIME_MS = 3_000;

/**
 * Builds pagination metadata. For free-text searches the count stops at SEARCH_COUNT_CAP + 1
 * (a substring regex can't use an index, so an exact count means scanning every document);
 * `totalCapped: true` tells the UI to show "1,000+". Non-search lists use an index-backed exact count.
 */
export async function paginate<T>(
  model: Model<T>,
  query: Record<string, unknown>,
  page: number,
  limit: number,
  isSearch: boolean
) {
  const total = isSearch
    ? await model.countDocuments(query, { limit: SEARCH_COUNT_CAP + 1, maxTimeMS: SEARCH_MAX_TIME_MS })
    : await model.countDocuments(query);
  const totalCapped = isSearch && total > SEARCH_COUNT_CAP;
  const shownTotal = totalCapped ? SEARCH_COUNT_CAP : total;
  return { page, limit, total: shownTotal, totalPages: Math.ceil(shownTotal / limit), totalCapped };
}

/** Confirmation-code-like input (e.g. "RV-7MN", "rv7mnd4") → normalized uppercase prefix, else null. */
export function confirmationCodePrefix(search: string): string | null {
  const s = search.trim().toUpperCase();
  const m = s.match(/^RV-?([2-9A-HJ-NP-Z]{1,8})$/);
  return m ? `RV-${m[1]}` : null;
}
