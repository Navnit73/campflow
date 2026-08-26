import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AddOnService } from "@/services/addon.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const result = await AddOnService.seedDefaultAddOns(
      session.organizationId,
      session.propertyId
    );

    return apiSuccess(result, "Standard add-ons initialized");
  } catch (error) {
    return handleApiError(error);
  }
}
