import { NextRequest } from "next/server";
import { requireRole, ROLES } from "@/lib/auth/session";
import { ExportService } from "@/services/export.service";
import { queryHistorySchema } from "@/lib/validations/export.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(ROLES.OWNER, req);
    const { searchParams } = new URL(req.url);

    const queryInput = queryHistorySchema.parse({
      type: searchParams.get("type") || undefined,
      status: searchParams.get("status") || undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
    });

    const data = await ExportService.listExportHistory(
      session.organizationId,
      session.propertyId,
      queryInput
    );

    return apiSuccess(data, "Export history loaded");
  } catch (error) {
    return handleApiError(error);
  }
}
