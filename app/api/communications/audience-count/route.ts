import { NextRequest } from "next/server";
import { requireRole, ROLES } from "@/lib/auth/session";
import { CommunicationService } from "@/services/communication.service";
import { audienceCountQuerySchema } from "@/lib/validations/communication.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(ROLES.OWNER, req);
    const { searchParams } = new URL(req.url);

    const query = audienceCountQuerySchema.parse({
      recipientFilter: searchParams.get("recipientFilter") || undefined,
    });

    const result = await CommunicationService.getAudienceCount(
      session.propertyId,
      query.recipientFilter
    );

    return apiSuccess(result, "Audience count retrieved");
  } catch (error) {
    return handleApiError(error);
  }
}
