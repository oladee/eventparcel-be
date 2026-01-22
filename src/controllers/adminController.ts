import { Request, Response } from "express";
import { UserService } from "../services/userServices";
import { EventService } from "../services/eventServices";
import cloudinary from "../middleware/cloudinary";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { sendMail } from "../utils/emailHandler/email";
import { AuthenticatedRequest } from "../middleware/authentication";
import { validateUser, validateAdmin, validateU, validateResetPassword } from "../middleware/validator";
import { resetNotification } from "../utils/emailHandler/resetNotification";
import { generateLoginOTP } from "../utils/emailHandler/sendOTP";
import { maskEmail, validatePhoneNumber, toTitleCase, generateOTP, generateToken, verifyToken, hashPassword, comparePassword, maintainRefreshTokens, generatePassword, titleCase, } from "../helpers/helpers";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import mongoose from "mongoose";
import { generateLoginNotificationEmail } from "../utils/emailHandler/sendLoginEmail";



// Function to handle Admin signup
export const signUp_Admin = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
      const { error } = validateUser(req.body);
      if (error) {
        return ErrorHandler.badUserInput(res, error.details[0].message);
      }

      const { firstName, lastName, email, phoneNumber, password, } = req.body;

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Check if the email already exists
      const existingUser = await UserService.getUserByField({email: normalizedEmail, role: "admin"});
      if (existingUser) {
        return ErrorHandler.conflict(res, "Admin email already exists!");
      }

      const normalizePhoneNumber = (phone: string) => {
        return phone.startsWith("+") ? phone.slice(1) : phone;
      }

      const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Validate phone number
    const phoneValidationResult = validatePhoneNumber(normalizedPhone);
    if (!phoneValidationResult.success) {
      return ErrorHandler.badUserInput(res, phoneValidationResult.message, {phoneNumber: normalizedPhone});
    }

      // Check if the phoneNumber already exists
      const checkPhone = await UserService.getUserByField({ phoneNumber: normalizedPhone });
      if (checkPhone) {
        return ErrorHandler.conflict(res, "User Phone Number already exists!", {phoneNumber: normalizedPhone})
      }

      // Hash the password
      const hashedPassword = await hashPassword(password, 12);

      // Create the User
      const newUser = await UserService.createUser({
          firstName: firstName.toLowerCase().trim(),
          lastName: lastName.toLowerCase().trim(),
          email: normalizedEmail,
          maskedEmail: maskEmail(normalizedEmail),
          phoneNumber: phoneValidationResult.phoneNumber,
          password: hashedPassword,
          isVerified: false,  // Set to false by default until OTP is verified
          role: "admin",
      });

      const token = generateToken({ userId: newUser._id }, "15m");

      // Generate OTP for verification
      const newOtp = generateOTP();
      newUser.otp = newOtp;
      newUser.accessToken = token;
      newUser.otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiration
      await newUser.save();

      const host = req.get("host");
      const protocol = host && host.includes("localhost") ? "http" : "https";
      const link = `${protocol}://${req.get("host")}/api/v1/verify-user/${newUser._id}/${newUser.accessToken}`;
      const name = `${newUser.firstName} ${newUser.lastName}`;

      // Send OTP via email
      await sendMail({
          email: newUser.email,
          html: generateLoginOTP((titleCase(name) ?? newUser.email), newOtp, link),
          subject: "OTP for User Verification",
      });

      return res.status(201).json({ 
          message: "Admin created successfully. Please check your email for the OTP", 
          data: newUser
      });

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message)
    }
  }
};



// Function to handle Admin login
export const loginAdmin = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
      const { error } = validateU(req.body);
      if (error) {
        return ErrorHandler.badUserInput(res, error.details[0].message)
      }

      const { email, password } = req.body;

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Find user by email
      const user = await UserService.getUserByField({
        email: normalizedEmail,
        role: { $in: ["admin", "superAdmin"] }
      });

      if (!user) {
          return ErrorHandler.notFound(res, "User not found", { email: normalizedEmail });
      }

      if (user.isDisabled) {
        return ErrorHandler.forbidden(res, "Admin has been disabled! Contact support");
      }

      if (user.status === "suspended") {
        return ErrorHandler.forbidden(res, "Admin has been suspended! Contact support");
      }

      if (user.status === "disabled") {
        return ErrorHandler.forbidden(res, "Admin has been disabled! Contact support");
      }

      // Check if user is verified
      if (!user.isVerified) {
      // Generate OTP for verification
      const token = generateToken({ userId: user._id }, "15m");
      const newOtp = generateOTP();
      user.otp = newOtp;
      user.accessToken = token;
      user.otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiration

      const host = req.get("host");
      const protocol = host && host.includes("localhost") ? "http" : "https";
      const link = `${protocol}://${req.get("host")}/api/v1/verify-user/${user._id}/${user.accessToken}`;
      const name = `${user.firstName} ${user.lastName}`;

      // // Send OTP via email
      await sendMail({
          email: user.email,
          html: generateLoginOTP((titleCase(name) ?? user.email), newOtp, link),
          subject: "OTP for User Verification",
      })
      await user.save();

        return ErrorHandler.forbidden(res, "User not verified. Please verify OTP first, check your mail");
      }

      if (!user.password) {
        return ErrorHandler.forbidden(res, "Account registered via social login. Please sign in using your Google, Facebook or Apple account.");
      }
      
      // Validate password
      const validPassword = await comparePassword(password, user.password);
      if (!validPassword) {
        return ErrorHandler.forbidden(res,"Incorrect email/Password. Please try again");
      }

      // Generate a JWT token
      const token = generateToken({ userId: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email }, "1d");
      const refreshToken =  generateToken({ userId: user._id }, "1d");

      // Hash refresh token before storing it in DB
      const hashedRefreshToken = await hashPassword(refreshToken, 10);
      user.accessToken = null;
      // Store multiple refresh tokens
      user.refreshToken = maintainRefreshTokens(user.refreshToken, hashedRefreshToken);
      user.isOtpVerified = false;
      user.lastLogin = new Date(Date.now()); // Update last login time
      user.status = user.status === "inactive" ? "active" : user.status;
      await user.save();

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true, secure: true, sameSite: 'none', 
        maxAge: 24 * 60 * 60 * 1000, // Cookie expiration: 1 day
        
        // secure: false, // Set to `false` for local testing (HTTP)
        // sameSite: 'strict',
        // maxAge: 24 * 60 * 60 * 1000, // 1 day
        // domain: 'localhost', // Explicitly set the domain
        // path: '/', 
    });

      // Check if the user just created an Event
      const checkEvent = await EventService.getEventByField({hostEmail: normalizedEmail});
      if (checkEvent && !checkEvent.user) {
        checkEvent.user = user._id as mongoose.Types.ObjectId;
        checkEvent.save();
      }

      // Remove sensitive data before responding
      // const { password: _password, otp, otpExpiry, otpAttempts, ...userWithoutSensitiveData } = user.toObject();
      const formattedData = {
        _id: user._id,
        firstName: toTitleCase(user.firstName),
        lastName: toTitleCase(user.lastName),
        email: user.email,
        maskedEmail: user.maskedEmail,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isVerified: user.isVerified,
        accessToken: user.accessToken ?? null,
        refreshToken: user.refreshToken ?? [],
        imageUrl: user.imageUrl ?? null,
        imagePublicId: user.imagePublicId ?? null,
        lastLogin: user.lastLogin ?? [],
        isOtpVerified: user.isOtpVerified,
        isDisabled: user.isDisabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
      

      return res.status(200).json({
          message: "Congratulations. You are in!",
          accessToken: token,
          data: formattedData,
      });

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};



// Function for a SuperAdmin to add another Admin
export const addAdmin = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
try {
  const { error } = validateAdmin(req.body);
  if (error) {
    return ErrorHandler.badUserInput(res, error.details[0].message);
  }

  const { firstName, lastName, email, role } = req.body;

  // Normalize email
  const normalizedEmail = email.toLowerCase().trim();

  // Check if the email already exists
  const existingUser = await UserService.getUserByField({ 
    email: normalizedEmail,         
    role: { $in: ["admin", "superAdmin"] }
  });
  if (existingUser) {
    return ErrorHandler.conflict(res, "Admin email already exists!");
  }

  const password = generatePassword();

  // Hash the password
  const hashedPassword = await hashPassword(password, 12);

  // Create the User
  const newUser = await UserService.createUser({
      firstName: firstName.toLowerCase().trim(),
      lastName: lastName.toLowerCase().trim(),
      email: normalizedEmail,
      role,
      maskedEmail: maskEmail(normalizedEmail),
      password: hashedPassword,
      isVerified: true,  // Set to false by default until OTP is verified
  });

  // const token = generateToken({ userId: newUser._id }, "15m");

  // // Generate OTP for verification
  // const newOtp = generateOTP();
  // newUser.otp = newOtp;
  // newUser.accessToken = token;
  // newUser.otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiration
  // await newUser.save();

  // const host = req.get("host");
  // const protocol = host && host.includes("localhost") ? "http" : "https";
  // const link = `${protocol}://${req.get("host")}/api/v1/verify-user/${newUser._id}/${newUser.accessToken}`;

  const name = `${firstName} ${lastName}`;

  // Send Admin details 
  await sendMail({
      email: newUser.email,
      html: generateLoginNotificationEmail((titleCase(name) ?? newUser.email), email, password),
      subject: "Admin Login Credentials",
  });

  return res.status(201).json({ 
      message: "Admin created successfully. Please check your email for details", 
      data: newUser
  });

} catch (error: any) {
// TEMPORARY CATCH FOR DUPLICATE KEY ERROR
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      return ErrorHandler.conflict(res, `The ${field} "${value}" is already in use. Please try another.`,
      );
    }


    return ErrorHandler.internalServerError(res, error.message);
  }
}



// Function to get all admin/superAdmin users
export const getAllAdminUsers = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
    const users = await UserService.getUsers({ role: { $in: ["admin", "superAdmin"] } });

    if (!users || users.length === 0) {
      return ErrorHandler.notFound(res, "No admin users found");
    }

    // Remove sensitive data for all users
    const sanitizedUsers = users.map(user => {
      const { password, otp, otpExpiry, otpAttempts, ...rest } = user.toObject();
      return rest;
    });

    return res.status(200).json({
      message: "Admin users fetched successfully",
      data: sanitizedUsers,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return ErrorHandler.internalServerError(res, message);
  }
};




// Function to Change Password 
export const changeAdminPassword = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
      const { error } = validateResetPassword(req.body);
      if (error) {
        return ErrorHandler.validationError(res, error.details[0].message)
      }
    const { email, currentPassword, password, confirmPassword } = req.body;
    if (!email ||!currentPassword || !password || !confirmPassword) {
      return ErrorHandler.validationError(res, "All fields are required!", { data: req.body })
    }

    const user = await UserService.getUserByField({
      email: email.toLowerCase(), 
      role: { $in: ["admin", "superAdmin"] }
    });
    if (!user) {
      return ErrorHandler.notFound(res, "User not found.")
    }

    if (password !== confirmPassword) {
      return ErrorHandler.validationError(res, "Passwords do not match.")
    }

    // Check the current password
    const checkCurrentPassword = await comparePassword(currentPassword, user.password);
    if (!checkCurrentPassword) return ErrorHandler.validationError(res, "Current password not correct!");

    const hashedPassword = await hashPassword(password, 12);

    const samePasswordAsOld = await comparePassword(currentPassword, hashedPassword);
    if (samePasswordAsOld) return ErrorHandler.validationError(res, "Please choose a password that's different from your current one.")

    user.password = hashedPassword;

    await user.save();

    return res.status(200).json({
      message: "Password change successful.",
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message)
    }
  }
};



// Function update Admin User Status
export const updateAdminUserStatus = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
  try {
    const { userId, status } = req.body;

    if (!userId || !status) {
      return ErrorHandler.badUserInput(res, "User ID and status are required.");
    }

    // Validate the status value
    const validStatuses = ["active", "inactive", "suspended", "disabled"];
    if (!validStatuses.includes(status)) {
      return ErrorHandler.badUserInput(res, "Invalid status value. Valid values are: active, inactive, disabled.");
    }

    // Find the user by ID
    const user = await UserService.getUserById(userId);
    if (!user) {
      return ErrorHandler.notFound(res, "User not found.");
    }

    // Update the user's status
    const updatedUser = await UserService.updateUserById(userId, { status }, true);
    if (!updatedUser) 
      return ErrorHandler.notFound(res, "Failed to update user status.");

    return sendResponse(res, 200, `User status updated to ${status}.`, updatedUser);

  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
}


// Function to disable / enable an Admin User
export const disableAndEnableAdminUser = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
  try {

    const { userId, isDisabled } = req.body;
    if (!userId) 
      return ErrorHandler.unauthenticated(res, "User not authenticated, please login!");

    if (typeof isDisabled !== "boolean") {
      return ErrorHandler.badUserInput(res, "User can only input true or false for isDisabled!");
    }
    
    const updatedUser = await UserService.updateUserById(userId, { isDisabled }, true);
    if (!updatedUser) {
      return ErrorHandler.validationError(res, "Unable to update Admin User!");
    }
    
    const message = isDisabled ? "Admin successfully disabled!" : "Admin successfully enabled!";
    
    return sendResponse(res, 200, message, updatedUser);

  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
}