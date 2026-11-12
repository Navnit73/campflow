import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { PropertyService } from "@/services/property.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

/** Owner onboarding checklist (computed from the park's real data). */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const status = await PropertyService.getSetupStatus(session.organizationId, session.propertyId);
    return apiSuccess(status, "Setup status loaded");
  } catch (error) {
    return handleApiError(error);
  }
}
