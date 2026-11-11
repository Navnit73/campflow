import mongoose from "mongoose";
import { Organization } from "@/models/Organization";
import { Property } from "@/models/Property";
import { SiteType } from "@/models/SiteType";
import { Site } from "@/models/Site";
import { Guest } from "@/models/Guest";
import { Reservation } from "@/models/Reservation";
import { Payment } from "@/models/Payment";
import { AddOn } from "@/models/AddOn";
import { User } from "@/models/User";

/** Deterministic PRNG so every benchmark run uses the same dataset. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const FIRST = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "David", "Susan", "Chris", "Karen", "Daniel", "Lisa", "Paul", "Nancy"];
const LAST = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Martin", "Lee", "Clark"];
const STATUSES: [string, number][] = [["checked_out", 0.55], ["confirmed", 0.2], ["cancelled", 0.12], ["checked_in", 0.03], ["pending", 0.05], ["no_show", 0.05]];

export interface SeedSize {
  sites: number;
  guests: number;
  reservations: number;
  paymentsPerReservation: number;
}

export interface SeededTenant {
  orgId: string;
  propertyId: string;
  slug: string;
  sampleGuestId: string;
  sampleReservationId: string;
  sampleConfirmationCode: string;
  siteIds: string[];
}

const DAY = 86_400_000;
const utcMidnight = (t: number) => new Date(Math.floor(t / DAY) * DAY);

export async function seedTenant(size: SeedSize, seed: number, label: string): Promise<SeededTenant> {
  const rand = rng(seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const org = await Organization.create({ name: `${label} Org`, slug: `${label}-org` });
  const property = await Property.create({
    organizationId: org._id,
    name: `${label} RV Park`,
    slug: `${label}-park`,
    address: { street: "1 Main", city: "Town", state: "CO", zip: "80000" },
    phone: "5550000000",
    email: `${label}@example.com`,
    timezone: "America/Denver",
    taxRatePercent: 8,
  });
  await User.create({ organizationId: org._id, name: "Owner", email: `${label}-owner@example.com`, passwordHash: "x", role: "owner" });
  const siteType = await SiteType.create({
    organizationId: org._id, propertyId: property._id, name: "Full Hookup", category: "rv_site",
    hookups: { electric: "50A", water: true, sewer: true }, maxRigLength: 45, defaultBaseRate: 60, maxOccupancy: 6,
  });

  const sites = Array.from({ length: size.sites }, (_, i) => ({
    _id: new mongoose.Types.ObjectId(),
    organizationId: org._id, propertyId: property._id, siteTypeId: siteType._id,
    siteNumber: `S${String(i + 1).padStart(4, "0")}`, name: `Site ${i + 1}`,
    status: rand() < 0.03 ? "maintenance" : "available",
    siteTypeSnapshot: { name: siteType.name, category: "rv_site", hookups: siteType.hookups, maxRigLength: 30 + Math.floor(rand() * 20) },
    currentBaseRate: 40 + Math.floor(rand() * 60), surfaceType: "gravel", rigType: "back_in", petFriendly: rand() < 0.8,
    amenities: ["picnic table"], photos: [], description: "", notes: "", sortOrder: i, createdAt: new Date(), updatedAt: new Date(),
  }));
  await Site.collection.insertMany(sites, { ordered: false });

  const now = Date.now();
  const guests = Array.from({ length: size.guests }, (_, i) => {
    const first = pick(FIRST);
    const last = pick(LAST);
    const created = new Date(now - rand() * 3 * 365 * DAY);
    return {
      _id: new mongoose.Types.ObjectId(),
      organizationId: org._id, propertyId: property._id,
      firstName: first, lastName: last, email: `${first}.${last}.${i}@${label}.example.com`.toLowerCase(),
      phone: `555${String(1000000 + i).slice(-7)}`,
      address: { street: "", city: "", state: "", zip: "", country: "USA" },
      rvDetails: { type: "travel_trailer", lengthFt: 20 + Math.floor(rand() * 20), licensePlate: `PL${i}`, state: "", makeModel: "" },
      notes: "", isVip: rand() < 0.05, isBlacklisted: rand() < 0.01, totalStays: 0, totalSpent: 0,
      createdAt: created, updatedAt: created,
    };
  });
  for (let i = 0; i < guests.length; i += 5000) await Guest.collection.insertMany(guests.slice(i, i + 5000), { ordered: false });

  const reservations: Record<string, unknown>[] = [];
  const payments: Record<string, unknown>[] = [];
  const sitePointer = new Map<number, number>(); // per-site next free day offset (keeps one site free of overlaps)
  for (let i = 0; i < size.reservations; i++) {
    const siteIdx = Math.floor(rand() * sites.length);
    const site = sites[siteIdx];
    const nights = 1 + Math.floor(rand() * 6);
    const startOffset = sitePointer.get(siteIdx) ?? -3 * 365 + Math.floor(rand() * 5);
    sitePointer.set(siteIdx, startOffset + nights + Math.floor(rand() * 3));
    const checkIn = utcMidnight(now + startOffset * DAY);
    const checkOut = new Date(checkIn.getTime() + nights * DAY);
    const r = rand();
    let acc = 0;
    let status = "confirmed";
    for (const [s, p] of STATUSES) {
      acc += p;
      if (r < acc) { status = s; break; }
    }
    if (checkIn.getTime() > now) status = rand() < 0.9 ? "confirmed" : "pending";
    const guest = pick(guests);
    const total = Number((site.currentBaseRate * nights * 1.08).toFixed(2));
    const paid = status === "cancelled" ? 0 : rand() < 0.8 ? total : Number((total / 2).toFixed(2));
    const created = new Date(checkIn.getTime() - (5 + rand() * 60) * DAY);
    const _id = new mongoose.Types.ObjectId();
    reservations.push({
      _id, organizationId: org._id, propertyId: property._id,
      confirmationCode: `RV-${label.slice(0, 2).toUpperCase()}${String(i).padStart(6, "0")}`,
      siteId: site._id, guestId: guest._id,
      siteSnapshot: { siteNumber: site.siteNumber, siteTypeName: siteType.name, hookups: siteType.hookups, rigType: "back_in", baseRate: site.currentBaseRate },
      guestSnapshot: { fullName: `${guest.firstName} ${guest.lastName}`, email: guest.email, phone: guest.phone, rvType: "travel_trailer", rvLengthFt: 30 },
      checkInDate: checkIn, checkOutDate: checkOut, numNights: nights, adults: 2, children: 0, pets: 0, status,
      addOns: [],
      pricing: { nightlyRate: site.currentBaseRate, baseSubtotal: site.currentBaseRate * nights, addOnsSubtotal: 0, discountAmount: 0, taxAmount: Number((total - site.currentBaseRate * nights).toFixed(2)), totalAmount: total, paidAmount: paid, balanceDue: Number((total - paid).toFixed(2)) },
      taxRatePercent: 8, source: pick(["admin", "online_booking", "phone", "walk_in"]), specialRequests: "", notes: "",
      createdAt: created, updatedAt: created,
    });
    for (let p = 0; p < size.paymentsPerReservation && paid > 0; p++) {
      payments.push({
        organizationId: org._id, propertyId: property._id, reservationId: _id, guestId: guest._id,
        type: "payment", amount: Number((paid / size.paymentsPerReservation).toFixed(2)), currency: "USD",
        method: pick(["credit_card", "cash", "online", "check"]), status: "completed",
        transactionReference: `TX${i}-${p}`, notes: "", createdAt: new Date(created.getTime() + p * DAY), updatedAt: created,
      });
    }
  }
  for (let i = 0; i < reservations.length; i += 5000) await Reservation.collection.insertMany(reservations.slice(i, i + 5000), { ordered: false });
  for (let i = 0; i < payments.length; i += 5000) await Payment.collection.insertMany(payments.slice(i, i + 5000), { ordered: false });

  await AddOn.create([
    { organizationId: org._id, propertyId: property._id, name: "Firewood", pricingType: "per_unit", price: 8.5, category: "merchandise" },
    { organizationId: org._id, propertyId: property._id, name: "Golf Cart", pricingType: "per_night", price: 45, category: "equipment" },
  ]);

  // A guest with a long history for the guest-detail benchmark.
  const heavyGuest = guests[0];
  await Reservation.collection.updateMany({ _id: { $in: reservations.slice(0, 300).map((r) => r._id as mongoose.Types.ObjectId) } }, { $set: { guestId: heavyGuest._id } });

  return {
    orgId: org._id.toString(),
    propertyId: property._id.toString(),
    slug: property.slug,
    sampleGuestId: heavyGuest._id.toString(),
    sampleReservationId: String(reservations[Math.floor(reservations.length / 2)]._id),
    sampleConfirmationCode: String(reservations[Math.floor(reservations.length / 2)].confirmationCode),
    siteIds: sites.filter((s) => s.status === "available").map((s) => s._id.toString()),
  };
}
