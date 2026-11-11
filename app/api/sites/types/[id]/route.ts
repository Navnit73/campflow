import { NextRequest } from "next/server";
import { requireRole, ROLES } from "@/lib/auth/session";
import { SiteService } from "@/services/site.service";
import { updateSiteTypeSchema } from "@/lib/validations/site.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(ROLES.MANAGERS, req);
    const { id } = await context.params;
    const body = await req.json();
    const validated = updateSiteTypeSchema.parse(body);

    const updated = await SiteService.updateSiteType(session.organizationId, session.propertyId, id, validated);
    return apiSuccess(updated, "Site type updated");
  } catch (error) {
    return handleApiError(error);
  }
}
