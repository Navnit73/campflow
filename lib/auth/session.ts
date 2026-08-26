import { cookies } from "next/headers";
import { AuthJwtPayload, verifyAuthToken } from "./jwt";
import { UserRole } from "@/lib/constants";

export const AUTH_COOKIE_NAME = "rv_session_token";

export async function getAuthSession(request?: Request): Promise<AuthJwtPayload | null> {
  // 1. Check Authorization header
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const payload = verifyAuthToken(token);
      if (payload) return payload;
    }
  }

  // 2. Check cookies
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (token) {
      const payload = verifyAuthToken(token);
      if (payload) return payload;
    }
  } catch {
    // cookies() might not be available in non-standard contexts
  }

  return null;
}

export async function requireAuth(request?: Request): Promise<AuthJwtPayload> {
  const session = await getAuthSession(request);
  if (!session) {
    const err = new Error("Unauthorized: Please sign in to continue");
    err.name = "UnauthorizedError";
    throw err;
  }
  return session;
}

export async function requireRole(allowedRoles: UserRole[], request?: Request): Promise<AuthJwtPayload> {
  const session = await requireAuth(request);
  if (!allowedRoles.includes(session.role)) {
    const err = new Error("Forbidden: You do not have permission for this action");
    err.name = "ForbiddenError";
    throw err;
  }
  return session;
}
