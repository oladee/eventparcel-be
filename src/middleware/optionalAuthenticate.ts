import express, { Request, Response, NextFunction } from "express";
import { User } from "../models/userModel";
import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export interface OptionalAuthenticateRequest extends Request {
  user?: { userId: string; firstName?: string; lastName?: string; email?: string } | any;
}

export const optionalAuthenticate = async (
  req: OptionalAuthenticateRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const hasAuthorization = req.headers.authorization;
    if (!hasAuthorization) return next(); // Skip authentication if no token

    const token = hasAuthorization.split(" ")[1];
    if (!token) return next();

    const SECRET = process.env.JWT_SECRET;
    if (!SECRET) {
      console.error("SECRET key is not defined in the environment variables.");
      return next();
    }

    // Verify token
    const decodedToken = jwt.verify(token, SECRET) as JwtPayload & { userId: string };
    const user = await User.findById(decodedToken.userId || decodedToken.id);

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

  } catch (error: any) {
    console.warn("⚠️ Optional authentication failed:", error.message);
  }

  next(); // Continue without blocking the request
};
