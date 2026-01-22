import { errorCodes } from "./errorCodes";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, statusCode: number, code: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Restore prototype chain (necessary when extending a built-in class)
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this);
  }

  // 404 - Not Found
  static notFound(message: string = "Resource not found", details?: any): AppError {
    return new AppError(message, 404, errorCodes.NOT_FOUND, details);
  }

  // 401 - Unauthorized (for missing or invalid credentials)
  static unauthorized(message: string = "Unauthorized", details?: any): AppError {
    return new AppError(message, 401, errorCodes.UNAUTHORIZED, details);
  }

  // 401 - Unauthenticated (user is not logged in)
  static unauthenticated(message: string = "Unauthenticated", details?: any): AppError {
    return new AppError(message, 401, errorCodes.UNAUTHENTICATED, details);
  }

  // 403 - Forbidden (logged in but not allowed)
  static forbidden(message: string = "Forbidden", details?: any): AppError {
    return new AppError(message, 403, errorCodes.FORBIDDEN, details);
  }

  // 400 - Bad User Input
  static badUserInput(message: string = "Bad user input", details?: any): AppError {
    return new AppError(message, 400, errorCodes.BAD_USER_INPUT, details);
  }

  // 409 - Conflict (duplicate resource, etc.)
  static conflict(message: string = "Conflict", details?: any): AppError {
    return new AppError(message, 409, errorCodes.CONFLICT, details);
  }

  // 429 - Too Many Requests
  static tooManyRequests(message: string = "Too many requests", details?: any): AppError {
    return new AppError(message, 429, errorCodes.TOO_MANY_REQUESTS, details);
  }

  // 500 - Internal Server Error (fallback)
  static internalServerError(message: string = "Internal server error", details?: any): AppError {
    return new AppError(message, 500, errorCodes.INTERNAL_SERVER_ERROR, details);
  }

  // Optionally, if you wish to differentiate a generic server error:
  static serverError(message: string = "Server error", details?: any): AppError {
    return new AppError(message, 500, errorCodes.SERVER_ERROR, details);
  }
}
