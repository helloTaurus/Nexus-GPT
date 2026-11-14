export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Session authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied', code: string = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = 'CONFLICT') {
    super(409, code, message);
  }
}

export class PolicyViolationError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(422, code, message, details);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string = 'Request payload exceeds maximum allowed limit (10MB)') {
    super(413, 'PAYLOAD_TOO_LARGE', message);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string = 'Disallowed file format. Only PDF, JPEG, and PNG are permitted.') {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', message);
  }
}
