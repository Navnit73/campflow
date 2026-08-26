import { NextResponse } from "next/server";
import { ZodError } from "zod";

export interface ApiResponseSuccess<T = any> {
  success: true;
  data: T;
  message: string;
}

export interface ApiResponseError {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export type ApiResponse<T = any> = ApiResponseSuccess<T> | ApiResponseError;

export function apiSuccess<T>(data: T, message = "Success", status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    } satisfies ApiResponseSuccess<T>,
    { status }
  );
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  fields?: Record<string, string>
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        fields,
      },
    } satisfies ApiResponseError,
    { status }
  );
}

export function handleApiError(err: unknown) {
  console.error("[API Error]", err);

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const path = issue.path.join(".");
      fields[path || "root"] = issue.message;
    }
    return apiError("VALIDATION_ERROR", "Validation failed on request payload or parameters", 422, fields);
  }

  if (err instanceof Error) {
    if (err.name === "UnauthorizedError" || err.message.includes("Unauthorized")) {
      return apiError("UNAUTHORIZED", err.message || "Authentication required", 401);
    }
    if (err.name === "ForbiddenError" || err.message.includes("Forbidden")) {
      return apiError("FORBIDDEN", err.message || "Access denied", 403);
    }
    if (err.name === "NotFoundError" || err.message.includes("not found")) {
      return apiError("NOT_FOUND", err.message || "Resource not found", 404);
    }
    if (err.name === "ConflictError" || err.message.includes("Conflict") || err.message.includes("already exists") || (err as any).code === 11000) {
      return apiError("CONFLICT", err.message || "Resource already exists or conflicting dates", 409);
    }
    return apiError("INTERNAL_ERROR", err.message || "An unexpected error occurred", 500);
  }

  return apiError("INTERNAL_ERROR", "Internal server error", 500);
}
