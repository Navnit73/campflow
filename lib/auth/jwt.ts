import jwt from "jsonwebtoken";
import { UserRole } from "@/lib/constants";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_default_rv_secret_change_in_prod";

export interface AuthJwtPayload {
  userId: string;
  organizationId: string;
  propertyId: string;
  email: string;
  role: UserRole;
  name: string;
}

export function signAuthToken(payload: AuthJwtPayload, expiresIn = "7d"): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as any);
}

export function verifyAuthToken(token: string): AuthJwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthJwtPayload;
    return decoded;
  } catch {
    return null;
  }
}
