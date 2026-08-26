/**
 * Normalized Date Utilities for CampFlow
 * Strictly operates on UTC midnight dates to avoid timezone shifts between client and server.
 */

export function parseDateOnly(dateStrOrObj: string | Date | undefined | null): Date {
  if (!dateStrOrObj) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  }

  if (dateStrOrObj instanceof Date) {
    if (isNaN(dateStrOrObj.getTime())) {
      const now = new Date();
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    }
    return new Date(
      Date.UTC(
        dateStrOrObj.getUTCFullYear(),
        dateStrOrObj.getUTCMonth(),
        dateStrOrObj.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );
  }

  const str = String(dateStrOrObj).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), 0, 0, 0, 0));
  }

  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  }
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0)
  );
}

export function formatDateKey(dateStrOrObj: string | Date | undefined | null): string {
  const d = parseDateOnly(dateStrOrObj);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateStrOrObj: string | Date, days: number): Date {
  const d = parseDateOnly(dateStrOrObj);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addDaysStr(dateStrOrObj: string | Date, days: number): string {
  return formatDateKey(addDays(dateStrOrObj, days));
}

export function diffDays(start: string | Date, end: string | Date): number {
  const dStart = parseDateOnly(start);
  const dEnd = parseDateOnly(end);
  const diffMs = dEnd.getTime() - dStart.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks if two date ranges overlap.
 * Hospitality semantics: check-in on Day X is allowed if previous guest checks out on Day X.
 * Overlap occurs if and only if: (startA < endB) AND (endA > startB)
 */
export function isDateOverlap(
  startA: string | Date,
  endA: string | Date,
  startB: string | Date,
  endB: string | Date
): boolean {
  const sA = parseDateOnly(startA).getTime();
  const eA = parseDateOnly(endA).getTime();
  const sB = parseDateOnly(startB).getTime();
  const eB = parseDateOnly(endB).getTime();

  return sA < eB && eA > sB;
}
