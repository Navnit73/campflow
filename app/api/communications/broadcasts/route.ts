import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CommunicationService } from "@/services/communication.service";
import { createBroadcastSchema } from "@/lib/validations/communication.schema";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
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
    const session = await requireAuth(req);
    const body = await req.json();
    const validated = createBroadcastSchema.parse(body);

    const broadcast = await CommunicationService.createAndSendBroadcast(
      session.organizationId,
      session.propertyId,
      { id: session.userId, name: session.name, email: session.email },
      validated
    );

    return apiSuccess(broadcast, "Announcement broadcast dispatched successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
