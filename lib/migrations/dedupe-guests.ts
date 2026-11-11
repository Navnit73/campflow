import mongoose from "mongoose";
import { Guest } from "@/models/Guest";
import { Reservation } from "@/models/Reservation";
import { Payment } from "@/models/Payment";

export interface DedupeReport {
  duplicateGroups: number;
  guestsMerged: number;
  reservationsRepointed: number;
  paymentsRepointed: number;
  indexCreated: boolean;
}

/**
 * Merges guest profiles that share (organizationId, lowercased email), then enforces uniqueness
 * with a unique index. Concurrent check-then-insert in older code could create such duplicates.
 *
 * Keeper = the oldest profile. Reservations/payments are re-pointed to it, lifetime counters are
 * summed, VIP/blacklist flags are OR-ed, notes are concatenated. Safe to re-run (idempotent).
 */
export async function dedupeGuests({ dryRun = false } = {}): Promise<DedupeReport> {
  const report: DedupeReport = { duplicateGroups: 0, guestsMerged: 0, reservationsRepointed: 0, paymentsRepointed: 0, indexCreated: false };

  const groups = await Guest.aggregate<{ _id: { org: mongoose.Types.ObjectId; email: string }; ids: mongoose.Types.ObjectId[] }>([
    { $group: { _id: { org: "$organizationId", email: { $toLower: { $trim: { input: "$email" } } } }, ids: { $push: "$_id" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]).allowDiskUse(true);

  report.duplicateGroups = groups.length;

  for (const group of groups) {
    const guests = await Guest.find({ _id: { $in: group.ids } }).sort({ createdAt: 1, _id: 1 }).lean();
    const [keeper, ...dupes] = guests;
    const dupeIds = dupes.map((g) => g._id);

    const [resCount, payCount] = await Promise.all([
      Reservation.countDocuments({ guestId: { $in: dupeIds } }),
      Payment.countDocuments({ guestId: { $in: dupeIds } }),
    ]);
    report.guestsMerged += dupes.length;
    report.reservationsRepointed += resCount;
    report.paymentsRepointed += payCount;
    if (dryRun) continue;

    const notes = [keeper.notes, ...dupes.map((d) => d.notes)].filter((n) => n && n.trim()).join("\n");
    await Promise.all([
      Reservation.updateMany({ guestId: { $in: dupeIds } }, { $set: { guestId: keeper._id } }),
      Payment.updateMany({ guestId: { $in: dupeIds } }, { $set: { guestId: keeper._id } }),
    ]);
    await Guest.updateOne(
      { _id: keeper._id },
      {
        $set: {
          email: group._id.email,
          notes,
          isVip: guests.some((g) => g.isVip),
          isBlacklisted: guests.some((g) => g.isBlacklisted),
        },
        $inc: {
          totalStays: dupes.reduce((s, g) => s + (g.totalStays || 0), 0),
          totalSpent: dupes.reduce((s, g) => s + (g.totalSpent || 0), 0),
        },
      }
    );
    await Guest.deleteMany({ _id: { $in: dupeIds } });
  }

  if (!dryRun) {
    const collection = Guest.collection;
    const indexes = await collection.indexes();
    const existing = indexes.find((i) => JSON.stringify(i.key) === JSON.stringify({ organizationId: 1, email: 1 }));
    if (existing && !existing.unique) await collection.dropIndex(existing.name!);
    if (!existing || !existing.unique) {
      await collection.createIndex({ organizationId: 1, email: 1 }, { unique: true, name: "organizationId_1_email_1" });
      report.indexCreated = true;
    }
  }

  return report;
}
