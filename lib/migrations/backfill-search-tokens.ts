import { Reservation } from "@/models/Reservation";
import { Guest } from "@/models/Guest";
import { guestTokens, reservationTokens } from "@/lib/search/tokens";

/**
 * Computes search tokens for documents written before indexed search existed. Idempotent;
 * processes in batches with bulkWrite. Until it completes for a property, search there uses the
 * legacy substring scan (correct, just slower).
 */
export async function backfillSearchTokens({ batchSize = 1000, dryRun = false } = {}) {
  const report = { reservations: 0, guests: 0 };

  for (;;) {
    const batch = await Reservation.find({ searchTokens: null })
      .select("confirmationCode guestSnapshot siteSnapshot")
      .limit(batchSize)
      .lean();
    if (!batch.length) break;
    report.reservations += batch.length;
    if (dryRun) break;
    await Reservation.bulkWrite(
      batch.map((r) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { searchTokens: reservationTokens(r) } } } }))
    );
  }

  for (;;) {
    const batch = await Guest.find({ searchTokens: null })
      .select("firstName lastName email phone rvDetails")
      .limit(batchSize)
      .lean();
    if (!batch.length) break;
    report.guests += batch.length;
    if (dryRun) break;
    await Guest.bulkWrite(
      batch.map((g) => ({ updateOne: { filter: { _id: g._id }, update: { $set: { searchTokens: guestTokens(g) } } } }))
    );
  }
  return report;
}
