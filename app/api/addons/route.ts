import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AddOnService } from "@/services/addon.service";
import { createAddOnSchema, queryAddOnsSchema } from "@/lib/validations/addon.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const queryInput = queryAddOnsSchema.parse({
      category: searchParams.get("category") || undefined,
      isActive: searchParams.get("isActive") || undefined,
      search: searchParams.get("search") || undefined,
    });

    const addOns = await AddOnService.getAddOns(
      session.organizationId,
      session.propertyId,
      queryInput
    );

    return apiSuccess(addOns, "Add-on services retrieved");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const validated = createAddOnSchema.parse(body);

    const addOn = await AddOnService.createAddOn(
      session.organizationId,
      session.propertyId,
      validated
    );

    return apiSuccess(addOn, "Add-on service created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
