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
    const result = await ReservationService.checkOut(
      session.organizationId,
      session.propertyId,
      id
    );
    return apiSuccess(result, "Guest checked out successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
