import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DashboardService } from "@/services/dashboard.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const summary = await DashboardService.getDashboardSummary(session.organizationId, session.propertyId);
    return apiSuccess(summary, "Dashboard data loaded");
  } catch (error) {
    return handleApiError(error);
  }
}
