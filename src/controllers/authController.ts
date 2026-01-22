import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/authentication";
import { UserService } from "../services/userServices";
import { generateToken, hashPassword, maintainRefreshTokens, } from "../helpers/helpers";
import { getGoogleContacts } from "../services/googleService";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { User } from "../models/userModel";
import jwt from "jsonwebtoken";

export const socialAuthCallback = async (req: AuthenticatedRequest, res: Response) => {
try {
    if (!req.user) {
      return res.status(404).json({ message: "User not found" });
    }

const user = await UserService.getUserById(req.user._id);
if (!user) return ErrorHandler.notFound(res, "User not found!");

    const token = jwt.sign({ userId: (req.user?._id as string) }, process.env.JWT_SECRET as string, { expiresIn: '1d' });

      const refreshToken = generateToken({ userId: user._id }, "1d");

      // Hash refresh token before storing it in DB
      const hashedRefreshToken = await hashPassword(refreshToken, 10);
      user.accessToken = null;
      // Store multiple refresh tokens
      user.refreshToken = maintainRefreshTokens(user.refreshToken, hashedRefreshToken);
      user.isOtpVerified = false;
      user.lastLogin = new Date(Date.now()); // Update last login time
      await user.save();

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true, secure: true, sameSite: 'none', 
        maxAge: 24 * 60 * 60 * 1000, // Cookie expiration: 1 day
    });

  
    // Set the token as an HTTP-only cookie.
    res.cookie("token", token, {
      httpOnly: true, // Prevents client-side JavaScript from accessing the cookie.
      secure: process.env.NODE_ENV === "production", // Sends the cookie only over HTTPS in production.
      sameSite: "none", // Adjust as needed ("strict", "lax", or "none")
      maxAge: 24 * 60 * 60 * 1000, // Cookie expiration: 1 day
    });
  
    // Redirect the user to the frontend. No need to include the token in the URL.
    res.redirect(`${process.env.CLIENT_URL}/dashboard?token=${token}`);
 // };
    } catch (error: any) {
      console.log(error)
      return ErrorHandler.internalServerError(res, error.message);
    }
};



// Function to display User Profile
export const userProfile = async (req: Request, res: Response): Promise<Response> => {
    try {
        const token = req.body.token;

        // If there's still no token, return an unauthorized response
        if (!token) {
            return res.status(401).json({ message: "Unauthorized: No token provided" });
        }
        
        // Verify and decode the token.
        // Assumes the token payload includes a property `_id`
        const tokenData = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload & { _id: string };
        
        // Query the user using the id from the token payload
        const user = await User.findById(tokenData.userId).select("-password, -otp, -otpExpiry, -otpAttempts");
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json(user);

    } catch (error: unknown) {
        if (error instanceof Error) {
            return res.status(500).json({
                error: "Internal Server Error: " + error.message
            });
        }
        return res.status(500).json({ error: "Unknown error occurred!" });
    }
};



// Callback - handle Google response & get contacts
export const getContactCallback = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {

      // ⏱️ Wait 5 seconds to allow cookies to be fully set
      await new Promise(resolve => setTimeout(resolve, 5000));

      const token = req.cookies.googleAccessToken;
      if (!token) return ErrorHandler.notFound(res, "Access token not found!");

      const contacts = await getGoogleContacts(token);

      return sendResponse(res, 200, "Google Contacts fetched successfully!", contacts);

    } catch (error: any) {
      console.log(error)
      return ErrorHandler.internalServerError(res, error.message);
    }
};
