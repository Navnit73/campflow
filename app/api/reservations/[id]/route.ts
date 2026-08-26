import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ReservationService } from "@/services/reservation.service";
import { updateReservationSchema } from "@/lib/validations/reservation.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    const data = await ReservationService.getReservationById(
      session.organizationId,
      session.propertyId,
      id
    );
    return apiSuccess(data, "Reservation loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json();
    const validated = updateReservationSchema.parse(body);

    const updated = await ReservationService.updateReservation(
      session.organizationId,
      session.propertyId,
      id,
      validated
    );
    return apiSuccess(updated, "Reservation updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
