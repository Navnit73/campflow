import { NextRequest } from "next/server";
import { requireRole, ROLES } from "@/lib/auth/session";
import { AddOnService } from "@/services/addon.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(ROLES.MANAGERS, req);

    const result = await AddOnService.seedDefaultAddOns(
      session.organizationId,
      session.propertyId
    );

    return apiSuccess(result, "Standard add-ons initialized");
  } catch (error) {
    return handleApiError(error);
  }
}
