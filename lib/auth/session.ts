import { cookies } from "next/headers";
import mongoose from "mongoose";
import { AuthJwtPayload, verifyAuthToken } from "./jwt";
import { UserRole } from "@/lib/constants";
import { ForbiddenError, UnauthorizedError } from "@/lib/utils/errors";

export const AUTH_COOKIE_NAME = "rv_session_token";

/** Role groups used by route guards. */
export const ROLES = {
  ALL: ["owner", "manager", "staff"] as UserRole[],
  MANAGERS: ["owner", "manager"] as UserRole[],
  OWNER: ["owner"] as UserRole[],
};

// Short-lived per-instance cache of user status so revocation/role changes apply within
// USER_CACHE_TTL_MS without a DB round-trip on every request.
const USER_CACHE_TTL_MS = 30_000;
const userCache = new Map<string, { isActive: boolean; role: UserRole; organizationId: string; expires: number }>();

async function loadUserState(userId: string) {
  const cached = userCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached;

  const { connectDB } = await import("@/lib/db/connection");
  const { User } = await import("@/models/User");
  await connectDB();
  if (!mongoose.isValidObjectId(userId)) return null;
  const user = await User.findById(userId).select("isActive role organizationId").lean();
  if (!user) {
    userCache.delete(userId);
    return null;
  }
  const state = {
    isActive: user.isActive !== false,
    role: user.role,
    organizationId: user.organizationId.toString(),
    expires: Date.now() + USER_CACHE_TTL_MS,
  };
  userCache.set(userId, state);
  return state;
}

/** Drops a cached user state (call after deactivating a user or changing a role). */
export function invalidateUserSession(userId: string) {
  userCache.delete(userId);
}

function readToken(request?: Request): Promise<string | null> | string | null {
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) return authHeader.substring(7).trim();
  }
  return (async () => {
    try {
      const cookieStore = await cookies();
      return cookieStore.get(AUTH_COOKIE_NAME)?.value || null;
    } catch {
      return null; // cookies() unavailable outside a request scope
    }
  })();
}

/**
 * Returns the verified session, or null. Besides the JWT signature, the user must still exist,
 * be active and belong to the same organization; the role is taken from the database so
 * demotions take effect without waiting for token expiry.
 */
export async function getAuthSession(request?: Request): Promise<AuthJwtPayload | null> {
  let token = await readToken(request);
  let payload = token ? verifyAuthToken(token) : null;

  // A stale Bearer header shouldn't mask a valid cookie.
  if (!payload && request?.headers.get("authorization")) {
    token = await readToken(undefined);
    payload = token ? verifyAuthToken(token) : null;
  }
  if (!payload) return null;

  const state = await loadUserState(payload.userId);
  if (!state || !state.isActive || state.organizationId !== payload.organizationId) return null;

  return { ...payload, role: state.role };
}

export async function requireAuth(request?: Request): Promise<AuthJwtPayload> {
  const session = await getAuthSession(request);
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requireRole(allowedRoles: UserRole[], request?: Request): Promise<AuthJwtPayload> {
  const session = await requireAuth(request);
  if (!allowedRoles.includes(session.role)) throw new ForbiddenError();
  return session;
}
