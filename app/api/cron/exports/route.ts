import { NextRequest } from "next/server";
import { ExportService } from "@/services/export.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";
import { requireCronSecret } from "@/lib/auth/cron";

async function run(req: NextRequest) {
  try {
    requireCronSecret(req);
    const result = await ExportService.runDueSchedules();
    return apiSuccess(result, `Processed ${result.processedCount} due export schedules`);
  } catch (error) {
    return handleApiError(error);
  }
}

// GET is what Vercel Cron invokes; both methods require the bearer secret.
export const GET = run;
export const POST = run;
