import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ReservationService } from "@/services/reservation.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const checkInDate = searchParams.get("checkInDate");
    const checkOutDate = searchParams.get("checkOutDate");
    const excludeReservationId = searchParams.get("excludeReservationId") || undefined;

    if (!checkInDate || !checkOutDate) {
      const err = new Error("Both checkInDate and checkOutDate are required query parameters");
      err.name = "ValidationError";
      throw err;
    }

    const sitesWithAvailability = await ReservationService.checkAllSitesAvailability(
      session.organizationId,
      session.propertyId,
      checkInDate,
      checkOutDate,
      excludeReservationId
    );

    return apiSuccess(sitesWithAvailability, "Sites availability loaded");
  } catch (error) {
    return handleApiError(error);
  }
}
