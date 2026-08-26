import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ReportService } from "@/services/report.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30", 10);

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
