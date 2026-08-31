import { NextRequest } from "next/server";
import { ExportService } from "@/services/export.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const result = await ExportService.runDueSchedules();
    return apiSuccess(result, `Processed ${result.processedCount} due export schedules`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await ExportService.runDueSchedules();
    return apiSuccess(result, `Processed ${result.processedCount} due export schedules`);
  } catch (error) {
    return handleApiError(error);
  }
}
