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

/* ------------------------------------------------------------------ */
/* Property-timezone helpers (Intl-based, no extra dependency).        */
/* ------------------------------------------------------------------ */

function safeTimeZone(tz?: string | null): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Calendar date ("YYYY-MM-DD") of `instant` as seen in timezone `tz`. */
export function zonedDateKey(instant: Date, tz?: string | null): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Offset (ms) of `tz` from UTC at `instant` (e.g. America/Denver in winter → -7h). */
function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The real instant at which local midnight of `dateKey` occurs in `tz` (DST-aware). */
export function zonedMidnight(dateKey: string, tz?: string | null): Date {
  return zonedTimeToInstant(dateKey, 0, 0, tz);
}

/** The real instant of local wall-clock time `hh:mm` on `dateKey` in `tz` (DST-aware). */
export function zonedTimeToInstant(dateKey: string, hours: number, minutes: number, tz?: string | null): Date {
  const zone = safeTimeZone(tz);
  const guess = parseDateOnly(dateKey).getTime() + (hours * 60 + minutes) * 60_000;
  let t = guess - tzOffsetMs(new Date(guess), zone);
  const corrected = guess - tzOffsetMs(new Date(t), zone);
  if (corrected !== t) t = corrected;
  return new Date(t);
}

/** Number of days in the month of `year`/`month0` (0-based month). */
export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}
