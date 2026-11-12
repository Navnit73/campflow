import { NextRequest } from "next/server";
import { requireRole, ROLES } from "@/lib/auth/session";
import { AddOnService } from "@/services/addon.service";
import { addOnTemplatesSchema } from "@/lib/validations/templates.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

/**
 * Create services from starter templates. Body: { items: [{ key, price }] } — the owner chooses
 * which templates to use and enters every price (templates carry no prices).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(ROLES.MANAGERS, req);
    const { items } = addOnTemplatesSchema.parse(await req.json().catch(() => ({})));
    const result = await AddOnService.createFromTemplates(session.organizationId, session.propertyId, items);
    return apiSuccess(result, `${result.created} service(s) added`, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
