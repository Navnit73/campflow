export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatDate(date: string | Date | undefined, formatStr = "MMM d, yyyy"): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC", // Use UTC to prevent date-shift for YYYY-MM-DD
  });
}

export function formatDateTime(date: string | Date | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatRvType(type: string): string {
  const map: Record<string, string> = {
    motorhome_a: "Class A Motorhome",
    motorhome_b: "Class B Camper Van",
    motorhome_c: "Class C Motorhome",
    fifth_wheel: "5th Wheel Trailer",
    travel_trailer: "Travel Trailer",
    truck_camper: "Truck Camper",
    van: "Campervan",
    tent: "Tent",
    other: "Other RV",
  };
  return map[type] || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function formatHookup(hookups: { electric?: string; water?: boolean; sewer?: boolean }): string {
  if (!hookups) return "Dry Site";
  const parts: string[] = [];
  if (hookups.electric && hookups.electric !== "none") parts.push(hookups.electric);
  if (hookups.water) parts.push("Water");
  if (hookups.sewer) parts.push("Sewer");
  if (parts.length === 3 && hookups.electric === "50A") return "50A Full Hookup";
  if (parts.length === 3 && hookups.electric === "30A") return "30A Full Hookup";
  if (parts.length === 0) return "Primitive / Dry";
  return parts.join(" / ");
}

export function formatRigType(rigType: string): string {
  if (rigType === "pull_through") return "Pull-Through";
  if (rigType === "back_in") return "Back-In";
  if (rigType === "tent") return "Tent Space";
  return rigType;
}

/** Joins the non-empty parts of a postal address ("" if none) — never emits ", ,". */
export function formatAddress(a?: { street?: string; city?: string; state?: string; zip?: string } | null): string {
  if (!a) return "";
  const stateZip = [a.state, a.zip].filter((x) => x && String(x).trim()).join(" ");
  return [a.street, a.city, stateZip].filter((x) => x && String(x).trim()).join(", ");
}
