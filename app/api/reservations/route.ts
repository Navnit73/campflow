import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ReservationService } from "@/services/reservation.service";
import {
  createReservationSchema,
  queryReservationsSchema,
} from "@/lib/validations/reservation.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const queryInput = queryReservationsSchema.parse({
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      siteId: searchParams.get("siteId") || undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
    });

    const data = await ReservationService.listReservations(
      session.organizationId,
      session.propertyId,
      queryInput
    );
    return apiSuccess(data, "Reservations loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const validated = createReservationSchema.parse(body);

    const created = await ReservationService.createReservation(
      session.organizationId,
      session.propertyId,
      validated,
      session.userId
    );
    return apiSuccess(created, "Reservation created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
