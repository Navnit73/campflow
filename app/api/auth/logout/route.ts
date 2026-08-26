import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/utils/api-response";
import { AUTH_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const response = apiSuccess({ loggedOut: true }, "Logged out successfully");
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });
  return response;
}
