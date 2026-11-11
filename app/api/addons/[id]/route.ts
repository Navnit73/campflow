import { NextRequest } from "next/server";
import { requireAuth, requireRole, ROLES } from "@/lib/auth/session";
import { AddOnService } from "@/services/addon.service";
import { updateAddOnSchema } from "@/lib/validations/addon.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;

    const addOn = await AddOnService.getAddOnById(
      session.organizationId,
      session.propertyId,
      id
    );

    return apiSuccess(addOn, "Add-on service loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(ROLES.MANAGERS, req);
    const { id } = await context.params;
    const body = await req.json();
    const validated = updateAddOnSchema.parse(body);

    const updated = await AddOnService.updateAddOn(
      session.organizationId,
      session.propertyId,
      id,
      validated
    );

    return apiSuccess(updated, "Add-on service updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(ROLES.MANAGERS, req);
    const { id } = await context.params;

    const result = await AddOnService.deleteAddOn(
      session.organizationId,
      session.propertyId,
      id
    );

    return apiSuccess(result, "Add-on service deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
