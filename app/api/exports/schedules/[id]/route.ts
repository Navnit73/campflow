import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ExportService } from "@/services/export.service";
import { updateScheduleSchema } from "@/lib/validations/export.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const resolvedParams = await params;
    const body = await req.json();
    const validated = updateScheduleSchema.parse(body);

    const schedule = await ExportService.updateSchedule(
      session.organizationId,
      session.propertyId,
      resolvedParams.id,
      validated
    );

    return apiSuccess(schedule, "Export schedule updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const resolvedParams = await params;

    const result = await ExportService.deleteSchedule(
      session.organizationId,
      session.propertyId,
      resolvedParams.id
    );

    return apiSuccess(result, "Export schedule deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
