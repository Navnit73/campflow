/**
 * Reconciles MongoDB indexes with the Mongoose schema declarations.
 *
 *   MONGODB_URI=... npx tsx scripts/sync-indexes.ts           # dry run: show what would change
 *   MONGODB_URI=... npx tsx scripts/sync-indexes.ts --apply   # create missing, drop undeclared
 *
 * Run scripts/migrate-dedupe-guests.ts first if guests may contain duplicate emails
 * (the unique {organizationId, email} index can't be built otherwise).
 * Index builds on large collections take time and I/O — run off-peak.
 */
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connection";

const MODELS = [
  "AddOn", "AuditLog", "Broadcast", "Discount", "ExportJob", "ExportSchedule", "Guest",
  "Organization", "Payment", "Property", "Reservation", "Site", "SiteType", "User",
];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI");
  const apply = process.argv.includes("--apply");
  await connectDB();
  for (const name of MODELS) await import(`@/models/${name}`);
  await import("@/lib/booking/site-lock");

  for (const model of Object.values(mongoose.models)) {
    const diff = await model.diffIndexes();
    if (!diff.toCreate.length && !diff.toDrop.length) continue;
    console.log(`\n${model.modelName}`);
    for (const idx of diff.toCreate) console.log("  + create", JSON.stringify(idx));
    for (const idx of diff.toDrop) console.log("  - drop  ", idx);
    if (apply) {
      await model.syncIndexes();
      console.log("  ✓ synced");
    }
  }
  if (!apply) console.log("\nDry run only. Re-run with --apply to make these changes.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
