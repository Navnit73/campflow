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

/**
 * Maps errors to HTTP responses by error *type/name* (not message substrings).
 * Unknown errors return a generic 500 message; details are logged server-side only.
 */
export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const path = issue.path.join(".");
      fields[path || "root"] = issue.message;
    }
    return apiError("VALIDATION_ERROR", "Validation failed on request payload or parameters", 422, fields);
  }

  if (err instanceof SyntaxError) {
    return apiError("BAD_REQUEST", "Request body is not valid JSON", 400);
  }

  if (err instanceof Error) {
    const e = err as Error & {
      fields?: Record<string, string>;
      errors?: Record<string, { message?: string }>;
      code?: number;
    };
    switch (err.name) {
      case "UnauthorizedError":
        return apiError("UNAUTHORIZED", err.message || "Authentication required", 401);
      case "ForbiddenError":
        return apiError("FORBIDDEN", err.message || "Access denied", 403);
      case "NotFoundError":
        return apiError("NOT_FOUND", err.message || "Resource not found", 404);
      case "ConflictError":
        return apiError("CONFLICT", err.message || "Conflicting request", 409);
      case "TooManyRequestsError":
        return apiError("RATE_LIMITED", err.message, 429);
      case "ValidationError": {
        // Our ValidationError carries `fields`; Mongoose's carries `errors`.
        let fields: Record<string, string> | undefined = e.fields;
        if (!fields && e.errors && typeof e.errors === "object") {
          fields = {};
          for (const [k, v] of Object.entries(e.errors)) fields[k] = v?.message || "Invalid value";
        }
        return apiError("VALIDATION_ERROR", err.message || "Validation failed", 422, fields);
      }
      case "CastError":
      case "BSONError":
        return apiError("INVALID_ID", "Invalid identifier supplied", 400);
    }
    if (e.code === 11000) {
      return apiError("CONFLICT", "Resource already exists", 409);
    }
  }

  console.error("[API Error]", err);
  return apiError("INTERNAL_ERROR", "An unexpected error occurred. Please try again.", 500);
}
