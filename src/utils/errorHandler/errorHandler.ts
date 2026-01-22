import { Response } from "express";
import { errorCodes } from "./errorCodes";

export class ErrorHandler {
  static notFound(res: Response, message: string = "Resource not found", details?: any): Response {
    return res.status(404).json({
      statusCode: 404,
      code: errorCodes.NOT_FOUND,
      message,
      ...(details ? { details } : {}),
    });
  }

  static unauthorized(res: Response, message: string = "Unauthorized", details?: any): Response {
    return res.status(401).json({
      statusCode: 401,
      code: errorCodes.UNAUTHORIZED,
      message,
      ...(details ? { details } : {}),
    });
  }

  static unauthenticated(res: Response, message: string = "Unauthenticated", details?: any): Response {
    return res.status(401).json({
      statusCode: 401,
      code: errorCodes.UNAUTHENTICATED,
      message,
      ...(details ? { details } : {}),
    });
  }

  static forbidden(res: Response, message: string = "Forbidden", details?: any): Response {
    return res.status(403).json({
      statusCode: 403,
      code: errorCodes.FORBIDDEN,
      message,
      ...(details ? { details } : {}),
    });
  }

  static badUserInput(res: Response, message: string = "Bad user input", details?: any): Response {
    return res.status(400).json({
      statusCode: 400,
      code: errorCodes.BAD_USER_INPUT,
      message,
      ...(details ? { details } : {}),
    });
  }

  static conflict(res: Response, message: string = "Conflict", details?: any): Response {
    return res.status(409).json({
      statusCode: 409,
      code: errorCodes.CONFLICT,
      message,
      ...(details ? { details } : {}),
    });
  }

  // Validation Error 
  static validationError(
    res: Response,
    message: string = "Validation error",
    details?: any
  ): Response {
    return res.status(400).json({
      statusCode: 400,
      code: errorCodes.VALIDATION_ERROR,
      message,
      ...(details ? { details } : {}),
    });
  }

  static tooManyRequests(res: Response, message: string = "Too many requests", details?: any): Response {
    return res.status(429).json({
      statusCode: 429,
      code: errorCodes.TOO_MANY_REQUESTS,
      message,
      ...(details ? { details } : {}),
    });
  }

  static internalServerError(res: Response, message: string = "Internal server error", details?: any): Response {
    return res.status(500).json({
      statusCode: 500,
      code: errorCodes.INTERNAL_SERVER_ERROR,
      message,
      ...(details ? { details } : {}),
    });
  }

  // Optionally, if you wish to differentiate a generic server error:
  static serverError(res: Response, message: string = "Server error", details?: any): Response {
    return res.status(500).json({
      statusCode: 500,
      code: errorCodes.SERVER_ERROR,
      message,
      ...(details ? { details } : {}),
    });
  }
}
