import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { PaymentService } from "@/services/payment.service";
import { createPaymentSchema, queryPaymentsSchema } from "@/lib/validations/payment.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const queryInput = queryPaymentsSchema.parse({
      reservationId: searchParams.get("reservationId") || undefined,
      method: searchParams.get("method") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
    });

    const data = await PaymentService.listPayments(
      session.organizationId,
      session.propertyId,
      queryInput
    );
    return apiSuccess(data, "Payments loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const validated = createPaymentSchema.parse(body);

    const result = await PaymentService.recordPayment(
      session.organizationId,
      session.propertyId,
      validated,
      session.userId
    );
    return apiSuccess(result, "Payment recorded successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
