import express, { Request, Response, NextFunction } from "express";
import { User } from "../models/userModel";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// Extend the Request interface for authentication
export interface AuthenticatedRequest extends Request {
  user?: { userId: string } | any;
}

const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const hasAuthorization = req.headers.authorization;
    if (!hasAuthorization) {
      return ErrorHandler.unauthorized(res, "Authorization header is missing")
    }

    const token = hasAuthorization.split(" ")[1];
    if (!token) {
      return ErrorHandler.notFound(res, "Token not found");
    }

    const SECRET = process.env.JWT_SECRET;
    if (!SECRET) {
      console.error("SECRET key is not defined in the environment variables.");
      return ErrorHandler.validationError(res, "Internal Server Error");
    }

    // Verify the token
    const decodedToken = jwt.verify(token, SECRET) as JwtPayload & {
      userId: string;
    };

    // Find the user in the database
    const user = await User.findById(decodedToken.userId || decodedToken.id);
    if (!user) {
      return ErrorHandler.notFound(res, "User not found", { user: user });
    }

    // Attach the user ID to the request
    if (user) {
      req.user = { 
        userId: user._id?.toString(), 
        firstName: user.firstName, 
        lastName: user.lastName, 
        email: user.email,
        role: user.role,
        hostEmail: user.role === 'cohost' ? user.hostEmail : user.email,
        hostId: user.role === "cohost" ? user.host : user._id,
      };
    }

    next();
  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError) {
      return ErrorHandler.unauthenticated(res, "Invalid or expired token, please log in again");
    }
    // console.error("Authentication error:", error);
    return ErrorHandler.internalServerError(res, `Authentication Error: ${error.message}`);
  }
};


// Middleware to authorize roles
const authorizeRole = (requiredRole: string) => {
  const roleHierarchy: Record<string, number> = {
      cohost: 1,
      host: 2,
      admin: 3,
      superAdmin: 4,
  };

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userRole = req.user?.role;

      // Check if the role exists and user has sufficient privileges
      if (!userRole || !(userRole in roleHierarchy)) {
          return ErrorHandler.validationError(res, "Invalid or missing role in the request.")
      }

      if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
          return ErrorHandler.unauthorized(res, "You do not have permission to access this resource!")
      }

      // User has sufficient privileges
      next();
  };
};




export { authenticate, authorizeRole, };
