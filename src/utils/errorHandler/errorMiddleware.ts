import { Request, Response, NextFunction } from "express";
import { AppError } from "./appError";  
import { errorCodes } from "./errorCodes";
import multer from "multer";


export interface MongoError extends Error {
    code?: number;
    keyPattern?: Record<string, number>;
    keyValue?: Record<string, any>;
  }
  

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  // If headers are already sent, delegate to Express's default error handler.
  if (res.headersSent) {
    console.warn("Headers already sent, delegating to Express");
    return next(err);
  }

  // Log the error
  console.error(err);

  // Define a unified error response structure.
  // Every response will include: statusCode, code, message, and optionally details.
  const buildResponse = (statusCode: number, code: string, message: string, details?: any) => ({
    statusCode,
    code,
    message,
    ...(details ? { details } : {}),
  });

  // 1. Handle Specific Errors


  // 1.a. Invalid JSON syntax errors (often thrown by express.json())
  if (
    err instanceof SyntaxError &&
    "status" in err &&
    (err as any).status === 400 &&
    "body" in err
  ) {
    return res.status(400).json(buildResponse(400, errorCodes.BAD_USER_INPUT, "Invalid JSON"));
  }

  // 1.b. Handle MongoDB duplicate key errors
  const mongoError = err as MongoError;
if (mongoError && mongoError.code === 11000) {
  const field = Object.keys(mongoError.keyValue || {})[0];
  const value = mongoError.keyValue ? mongoError.keyValue[field] : "";

  return res.status(409).json(
    buildResponse(
      409,
      errorCodes.CONFLICT,
      `The ${field} "${value}" is already in use. Please try another.`
    )
  );
}


  // 1.c. Handle Multer file upload errors
  if (err instanceof multer.MulterError) {
    if ((err as multer.MulterError).code === "LIMIT_FILE_SIZE") {
      return res.status(400).json(
        buildResponse(
          400,
          errorCodes.BAD_USER_INPUT,
          "File size too large. Please upload a file less than 5MB."
        )
      );
    }
    return res.status(400).json(
      buildResponse(400, errorCodes.BAD_USER_INPUT, "Invalid file format. Please upload an image.")
    );
  }

  if (err.message === "Only images (JPEG, PNG) are allowed!") {
    // Custom file type validation error
    return res.status(400).json({ error: err.message });
  }

  if (err.message === "Only .pdf or .docx files are allowed!") {
    // Custom file type validation error
    return res.status(400).json({ error: err.message });
  }

  if (err.message === "File too large") {
    // Custom file size validation error
    return res.status(400).json({ error: "File size exceeds the 10MB limit" });
  }

  // 2. Handle Custom Application Errors (AppError)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(
      buildResponse(err.statusCode, err.code, err.message, err.details)
    );
  }

  // 3. Fallback: Return a generic 500 Internal Server Error
  return res.status(500).json(
    buildResponse(500, errorCodes.SERVER_ERROR, "Internal Server Error")
  );

};
