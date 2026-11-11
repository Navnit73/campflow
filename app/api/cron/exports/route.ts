import { NextRequest } from "next/server";
import { ExportService } from "@/services/export.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";
import { requireCronSecret } from "@/lib/auth/cron";
import { CommunicationService } from "@/services/communication.service";

async function run(req: NextRequest) {
  try {
    requireCronSecret(req);
    const result = await ExportService.runDueSchedules();
    // Same cron tick also recovers interrupted broadcasts (additive field in the response).
    const broadcasts = await CommunicationService.recoverStuckBroadcasts().catch((e) => {
      console.error("[Cron] Broadcast recovery failed:", e);
      return { redelivered: 0, abandoned: 0 };
    });
    return apiSuccess({ ...result, broadcasts }, `Processed ${result.processedCount} due export schedules`);
  } catch (error) {
    return handleApiError(error);
  }
}

// GET is what Vercel Cron invokes; both methods require the bearer secret.
export const GET = run;
export const POST = run;
