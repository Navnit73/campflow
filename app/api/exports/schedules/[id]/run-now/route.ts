import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ExportService } from "@/services/export.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const resolvedParams = await params;

    const result = await ExportService.runScheduleNow(
      resolvedParams.id,
      session.organizationId,
      session.propertyId
    );

    return apiSuccess(result, "Scheduled export executed and report dispatched via email");
  } catch (error) {
    return handleApiError(error);
  }
}
