/**
 * Usage:
 *   MONGODB_URI=... npx tsx scripts/migrate-dedupe-guests.ts --dry-run   # report only
 *   MONGODB_URI=... npx tsx scripts/migrate-dedupe-guests.ts             # merge + create unique index
 * Take a backup first.
 */
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connection";
import { dedupeGuests } from "@/lib/migrations/dedupe-guests";

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI");
  const dryRun = process.argv.includes("--dry-run");
  await connectDB();
  const report = await dedupeGuests({ dryRun });
  console.log(JSON.stringify({ dryRun, ...report }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
