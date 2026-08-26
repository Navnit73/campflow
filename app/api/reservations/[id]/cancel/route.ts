import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ReservationService } from "@/services/reservation.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const result = await ReservationService.cancelReservation(
      session.organizationId,
      session.propertyId,
      id,
      body.notes
    );
    return apiSuccess(result, "Reservation cancelled successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
