import { NextRequest } from "next/server";
import { requireAuth, requireRole, ROLES } from "@/lib/auth/session";
import { SiteService } from "@/services/site.service";
import { createSiteSchema } from "@/lib/validations/site.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const siteTypeId = searchParams.get("siteTypeId") || undefined;

    const sites = await SiteService.listSites(session.organizationId, session.propertyId, {
      status,
      siteTypeId,
    });

    return apiSuccess(sites, "Sites loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(ROLES.MANAGERS, req);
    const body = await req.json();
    const validated = createSiteSchema.parse(body);

    const site = await SiteService.createSite(session.organizationId, session.propertyId, validated);
    return apiSuccess(site, "Site created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
