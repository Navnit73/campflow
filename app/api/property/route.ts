import { NextRequest } from "next/server";
import { requireAuth, requireRole, ROLES } from "@/lib/auth/session";
import { PropertyService } from "@/services/property.service";
import { updatePropertySchema } from "@/lib/validations/property.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const property = await PropertyService.getProperty(session.organizationId, session.propertyId);
    return apiSuccess(property, "Property settings loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireRole(ROLES.OWNER, req);
    const input = updatePropertySchema.parse(await req.json());
    const property = await PropertyService.updateProperty(session.organizationId, session.propertyId, input);
    return apiSuccess(property, "Property settings saved");
  } catch (error) {
    return handleApiError(error);
  }
}
