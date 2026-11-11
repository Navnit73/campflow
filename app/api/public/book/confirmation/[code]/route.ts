import { NextRequest } from "next/server";
import { PublicBookingService } from "@/services/public-booking.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";
import { rateLimitRequest } from "@/lib/utils/rate-limit";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    await rateLimitRequest(req, "public-confirmation", 30, 60_000);
    const { code } = await context.params;
    const slug = new URL(req.url).searchParams.get("slug") || undefined;
    const data = await PublicBookingService.getBookingConfirmation(code, slug);
    return apiSuccess(data, "Reservation confirmation loaded");
  } catch (error) {
    return handleApiError(error);
  }
}
