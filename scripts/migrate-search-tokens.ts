/**
 * Backfills indexed search tokens for existing reservations and guests.
 *   MONGODB_URI=... npx tsx scripts/migrate-search-tokens.ts [--dry-run]
 * Run after deploying (and after scripts/sync-indexes.ts --apply). Safe to re-run.
 */
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connection";
import { backfillSearchTokens } from "@/lib/migrations/backfill-search-tokens";

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI");
  await connectDB();
  const report = await backfillSearchTokens({ dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
