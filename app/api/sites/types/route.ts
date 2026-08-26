import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { SiteService } from "@/services/site.service";
import { createSiteTypeSchema } from "@/lib/validations/site.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const types = await SiteService.listSiteTypes(session.organizationId, session.propertyId);
    return apiSuccess(types, "Site types loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const validated = createSiteTypeSchema.parse(body);

    const created = await SiteService.createSiteType(session.organizationId, session.propertyId, validated);
    return apiSuccess(created, "Site type created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
