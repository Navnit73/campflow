import { NextRequest } from "next/server";
import { PublicBookingService } from "@/services/public-booking.service";
import { publicAvailabilityQuerySchema } from "@/lib/validations/public-booking.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const queryInput = publicAvailabilityQuerySchema.parse({
      slug: searchParams.get("slug") || "",
      checkInDate: searchParams.get("checkInDate") || "",
      checkOutDate: searchParams.get("checkOutDate") || "",
      rvType: searchParams.get("rvType") || "travel_trailer",
      rigLengthFt: searchParams.get("rigLengthFt") || 30,
      hookupType: searchParams.get("hookupType") || undefined,
      siteCategory: searchParams.get("siteCategory") || undefined,
      adults: searchParams.get("adults") || 2,
      children: searchParams.get("children") || 0,
      pets: searchParams.get("pets") || 0,
    });

    const result = await PublicBookingService.searchAvailableSites(queryInput);
    return apiSuccess(result, "Available sites retrieved");
  } catch (error) {
    return handleApiError(error);
  }
}
