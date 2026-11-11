import { NextRequest, after } from "next/server";
import { requireRole, ROLES } from "@/lib/auth/session";

// Upper bound for post-response delivery on platforms that honour it (seconds).
export const maxDuration = 300;
import { CommunicationService } from "@/services/communication.service";
import { createBroadcastSchema } from "@/lib/validations/communication.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(ROLES.OWNER, req);
    const history = await CommunicationService.getBroadcastHistory(
      session.organizationId,
      session.propertyId
    );

    return apiSuccess(history, "Broadcast history loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(ROLES.OWNER, req);
    const body = await req.json();
    const validated = createBroadcastSchema.parse(body);
    const idempotencyKey =
      (typeof body?.idempotencyKey === "string" && body.idempotencyKey.slice(0, 128)) ||
      req.headers.get("idempotency-key")?.slice(0, 128) ||
      undefined;

    const { broadcast, created } = await CommunicationService.createBroadcast(
      session.organizationId,
      session.propertyId,
      { id: session.userId, name: session.name },
      { ...validated, idempotencyKey }
    );

    // Deliver after the response is sent so a large audience can't time out the request.
    if (created && broadcast?._id) {
      const id = String(broadcast._id);
      after(() => CommunicationService.deliverBroadcast(id).catch((e) => console.error("[Broadcast] deliver failed:", e)));
    }

    return apiSuccess(
      broadcast,
      created ? "Announcement queued for delivery" : "This announcement was already submitted",
      created ? 202 : 200
    );
  } catch (error) {
    return handleApiError(error);
  }
}
