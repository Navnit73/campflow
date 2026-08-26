import { NextRequest } from "next/server";
import { PublicBookingService } from "@/services/public-booking.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const data = await PublicBookingService.getBookingConfirmation(code);
    return apiSuccess(data, "Reservation confirmation loaded");
  } catch (error) {
    return handleApiError(error);
  }
}
