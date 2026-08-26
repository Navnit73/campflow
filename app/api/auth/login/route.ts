import { NextRequest } from "next/server";
import { loginSchema } from "@/lib/validations/auth.schema";
import { AuthService } from "@/services/auth.service";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";
import { AUTH_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = loginSchema.parse(body);
    const result = await AuthService.login(validated);

    const response = apiSuccess(result, "Logged in successfully");
    response.cookies.set(AUTH_COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
