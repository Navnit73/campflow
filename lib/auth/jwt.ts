import jwt from "jsonwebtoken";
import { UserRole } from "@/lib/constants";

const DEV_FALLBACK_SECRET = "dev_only_insecure_jwt_secret_do_not_use_in_production";
let warned = false;

/**
 * Resolves the signing secret lazily (so `next build` doesn't need it).
 * In production a missing/short secret is a hard failure: a guessable secret would let
 * anyone forge an owner token for any organization.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to at least 32 characters in production.");
  }
  if (!warned) {
    console.warn("[Auth] JWT_SECRET missing or shorter than 32 chars — using an insecure development secret.");
    warned = true;
  }
  return secret || DEV_FALLBACK_SECRET;
}

export interface AuthJwtPayload {
  userId: string;
  organizationId: string;
  propertyId: string;
  email: string;
  role: UserRole;
  name: string;
}

export function signAuthToken(payload: AuthJwtPayload, expiresIn = "7d"): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn, algorithm: "HS256" } as jwt.SignOptions);
}

export function verifyAuthToken(token: string): AuthJwtPayload | null {
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as AuthJwtPayload;
  } catch {
    return null;
  }
}
