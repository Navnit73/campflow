import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { GuestService } from "@/services/guest.service";
import { updateGuestSchema } from "@/lib/validations/guest.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    const data = await GuestService.getGuestById(session.organizationId, session.propertyId, id);
    return apiSuccess(data, "Guest profile and history loaded");
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
    const validated = updateGuestSchema.parse(body);

    const updated = await GuestService.updateGuest(session.organizationId, session.propertyId, id, validated);
    return apiSuccess(updated, "Guest profile updated");
  } catch (error) {
    return handleApiError(error);
  }
}
