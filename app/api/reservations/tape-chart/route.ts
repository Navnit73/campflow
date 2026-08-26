import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ReservationService } from "@/services/reservation.service";
import { tapeChartQuerySchema } from "@/lib/validations/reservation.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const todayStr = new Date().toISOString().split("T")[0];
    const queryInput = tapeChartQuerySchema.parse({
      startDate: searchParams.get("startDate") || todayStr,
      days: searchParams.get("days") || 14,
    });

    const data = await ReservationService.getTapeChartData(
      session.organizationId,
      session.propertyId,
      queryInput.startDate,
      queryInput.days
    );

    return apiSuccess(data, "Tape chart grid data loaded");
  } catch (error) {
    return handleApiError(error);
  }
}
