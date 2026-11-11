import { NextRequest } from "next/server";
import { requireRole, ROLES } from "@/lib/auth/session";
import { ReportService } from "@/services/report.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(ROLES.MANAGERS, req);
    const { searchParams } = new URL(req.url);
    const parsedDays = Number.parseInt(searchParams.get("days") || "30", 10);
    const days = Number.isFinite(parsedDays) ? Math.min(366, Math.max(1, parsedDays)) : 30;

    const data = await ReportService.getFinancialReports(
      session.organizationId,
      session.propertyId,
      days
    );
    return apiSuccess(data, "Financial & occupancy report loaded");
  } catch (error) {
    return handleApiError(error);
  }
}
