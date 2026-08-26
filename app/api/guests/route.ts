import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { GuestService } from "@/services/guest.service";
import { createGuestSchema, queryGuestsSchema } from "@/lib/validations/guest.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const queryInput = queryGuestsSchema.parse({
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
    });

    const data = await GuestService.listGuests(session.organizationId, session.propertyId, queryInput);
    return apiSuccess(data, "Guests list loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const validated = createGuestSchema.parse(body);

    const created = await GuestService.createGuest(session.organizationId, session.propertyId, validated);
    return apiSuccess(created, "Guest profile created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
