import { NextRequest } from "next/server";
import { PublicBookingService } from "@/services/public-booking.service";
import { publicCreateBookingSchema } from "@/lib/validations/public-booking.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";
import { rateLimitRequest } from "@/lib/utils/rate-limit";

export async function POST(req: NextRequest) {
  try {
    await rateLimitRequest(req, "public-book-create", 10, 10 * 60_000);
    const body = await req.json();
    const validated = publicCreateBookingSchema.parse(body);

    const result = await PublicBookingService.createPublicBooking(validated);
    return apiSuccess(result, "Booking confirmed successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
