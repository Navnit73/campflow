/**
 * Typed application errors. `name` is kept identical to the legacy string names
 * (e.g. "NotFoundError") so existing `err.name === ...` checks keep working.
 */
export class AppError extends Error {
  constructor(name: string, message: string, public fields?: Record<string, string>) {
    super(message);
    this.name = name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super("ValidationError", message, fields);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super("NotFoundError", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("ConflictError", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden: You do not have permission for this action") {
    super("ForbiddenError", message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized: Please sign in to continue") {
    super("UnauthorizedError", message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests. Please slow down and try again shortly.") {
    super("TooManyRequestsError", message);
  }
}
