import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { SiteService } from "@/services/site.service";
import { updateSiteSchema } from "@/lib/validations/site.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    const site = await SiteService.getSiteById(session.organizationId, session.propertyId, id);
    return apiSuccess(site, "Site details loaded");
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
    const validated = updateSiteSchema.parse(body);

    const updated = await SiteService.updateSite(session.organizationId, session.propertyId, id, validated);
    return apiSuccess(updated, "Site updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    const result = await SiteService.deleteSite(session.organizationId, session.propertyId, id);
    return apiSuccess(result, "Site deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
