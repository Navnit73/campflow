import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AuthService } from "@/services/auth.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const data = await AuthService.getMe(session.userId);
    return apiSuccess(data, "Session retrieved");
  } catch (error) {
    return handleApiError(error);
  }
}
