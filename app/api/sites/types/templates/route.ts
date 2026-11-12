import { NextRequest } from "next/server";
import { requireRole, ROLES } from "@/lib/auth/session";
import { SiteService } from "@/services/site.service";
import { siteCategoryTemplatesSchema } from "@/lib/validations/templates.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

/** Create site categories from starter templates. Body: { items: [{ key, price }] } (price = default nightly rate). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(ROLES.MANAGERS, req);
    const { items } = siteCategoryTemplatesSchema.parse(await req.json().catch(() => ({})));
    const result = await SiteService.createSiteTypesFromTemplates(session.organizationId, session.propertyId, items);
    return apiSuccess(result, `${result.created} site categor${result.created === 1 ? "y" : "ies"} added`, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
