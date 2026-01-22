import { Request, Response } from "express";
import { UserService } from "../services/userServices";
import { EventService } from "../services/eventServices";
import cloudinary from "../middleware/cloudinary";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { sendMail } from "../utils/emailHandler/email";
import { AuthenticatedRequest } from "../middleware/authentication";
import { validateUser, validateU, validateResetPassword, validateUpdatedUser, validateEmail, validateCoHost } from "../middleware/validator";
import { resetNotification } from "../utils/emailHandler/resetNotification";
import { generateLoginOTP } from "../utils/emailHandler/sendOTP";
import { generateCoHostInvitationEmail } from '../utils/emailHandler/generateCoHostDecisionEmail ';
import { generateHostAcceptedEmail } from '../utils/emailHandler/generateHostAcceptedEmail';
import { generateHostDeclinedEmail } from '../utils/emailHandler/generateHostDeclinedEmail ';
import { maskEmail, validatePhoneNumber, toTitleCase, titleCase, generateOTP, generateToken, verifyToken, hashPassword, comparePassword, maintainRefreshTokens, uploadImage, } from "../helpers/helpers";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { emailInvitePage } from "../utils/emailHandler/generateInvitePage";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/userModel";
import ActivityLogService from "../services/activityLogService";
import { ICoHost, IEventCoHosts } from "../interfaces/modelInterface";
import crypto from "crypto";
import { CoHostInvite } from "../models/coHostInviteModel";
import { CoHostInviteService } from "../services/coHostInviteService";



// Function to handle User signup
export const signUp_User = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
      const { error } = validateUser(req.body);
      if (error) {
        return ErrorHandler.badUserInput(res, error.details[0].message);
      }

      const { firstName, lastName, email, phoneNumber, password, } = req.body;

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Check if the email already exists
      const existingUser = await UserService.getUserByField({email: normalizedEmail, role: "host"});
      if (existingUser) {
        return ErrorHandler.conflict(res, "User email already exists!", { email: normalizedEmail });
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
      const checkPhone = await UserService.getUserByField({ phoneNumber: normalizedPhone, role: "host" });
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
          role: "host",
      });

      const token = generateToken({ userId: newUser._id }, "15m");

      // Generate OTP for verification
      const newOtp = generateOTP();
      newUser.otp = newOtp;
      newUser.accessToken = token;
      newUser.otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiration
      // await newUser.save();

      const host = req.get("host");
      const protocol = host && host.includes("localhost") ? "http" : "https";
      const link = `${protocol}://${req.get("host")}/api/v1/verify-user/${newUser._id}/${newUser.accessToken}`;
      const name = `${newUser.firstName} ${newUser.lastName}`;

      
      // await sendMail({
      //     email: newUser.email,
      //     html: generateLoginOTP((titleCase(name) ?? newUser.email), newOtp, link),
      //     subject: "OTP for User Verification",
      // });
      
      // Send OTP via email
      await Promise.all([
        newUser.save(),
        sendMail({
          email: newUser.email,
          html: generateLoginOTP((titleCase(name) ?? newUser.email), newOtp, link),
          subject: "OTP for User Verification",
        })
      ]);


      // Check if the user just created an Event
      const checkEvent = await EventService.getEventByField({hostEmail: normalizedEmail});
      if (checkEvent && !checkEvent.user) {
        checkEvent.user = newUser._id as mongoose.Types.ObjectId;
        checkEvent.save();
      }

      return res.status(201).json({ 
          message: "User created successfully. Please check your email for the OTP", 
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

      return ErrorHandler.internalServerError(res, error.message)

  }
};


// Function to add coHost to an Event
export const AddCoHost = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
      const { error } = validateUser(req.body);
      if (error) {
        return ErrorHandler.badUserInput(res, error.details[0].message);
      }

      const { eventId, firstName, lastName, email, phoneNumber, password } = req.body;

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Check if the email already exists
      const existingUser = await UserService.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return ErrorHandler.conflict(res, "User email already exists!", { email: normalizedEmail });
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
          role: "cohost"
      });

      const token = generateToken({ userId: newUser._id }, "15m");

      const hostEmail = req.cookies.hostEmail || ""; 

      // Generate OTP for verification
      const newOtp = generateOTP();
      newUser.otp = newOtp;
      newUser.accessToken = token;
      newUser.otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiration
      // newUser.hostEmail = hostEmail;
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
      
      // Add CoHost to an event
      const event = await EventService.getEventById(eventId);
      if (event) {
        event.coHost.push(newUser._id as mongoose.Types.ObjectId);
        await event.save();
      }

      return res.status(201).json({ 
          message: "User created successfully. Please check your email for the OTP", 
          data: newUser
      });

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error instanceof Error ? error.message : "An unexpected error occurred")
    }
  }
};



// Function to handle OTP verification
export const verifyOTP = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
      const { email, otp } = req.body;

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Find user by email
      const user = await UserService.getUserByEmail(normalizedEmail);
      if (!user) {
          return ErrorHandler.notFound(res, "User not found", { email: normalizedEmail });
      }

      // Check if OTP is expired
      if (!user.otpExpiry || new Date() > user.otpExpiry) {
          return ErrorHandler.validationError(res, "OTP has expired, please request a new one");
      }

      // Check if OTP matches
      if (user.otp !== otp) {
          user.otpAttempts = (user.otpAttempts || 0) + 1;
          await user.save();

          if (user.otpAttempts >= 3) {
              user.otp = undefined; // Invalidate OTP
              user.otpExpiry = undefined; // Remove expiry time
              await user.save();

              return ErrorHandler.validationError(res, "Too many failed attempts. OTP has been invalidated. Please request a new OTP.");
          }

          return ErrorHandler.validationError(res, `Invalid OTP. You have ${3 - user.otpAttempts} attempts left.`);
      }

      // If OTP is correct, set user as verified
      user.isVerified = true;
      user.isOtpVerified = true;
      user.otp = undefined; // Clear OTP after successful verification
      user.otpExpiry = null; // Clear OTP expiry
      user.otpAttempts = 0; // Reset attempts
      user.status = "active";
      await user.save();

      return res.status(200).json({
          message: "OTP verified successfully. You can now log in.",
      });

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message)
    }
  }
};




//Function to verify a new user through link
export const verify_Email = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
    const { id, token } = req.params;

    const user = await UserService.getUserById(id);
    if (!user) return ErrorHandler.notFound(res, "user not found", { userId: id });

    // Check if user already verified
    if (user?.isVerified) {
      res.redirect("https://event-parcel.vercel.app/alreadyVerify")
      return;
    }

    // Verify the token
    const decodedToken = await verifyToken(token);
      if (!decodedToken.valid) {
        // If token is invalid/expired, generate a new token and ask the user to re-verify
        const newToken = generateToken({ userId: user._id }, "15m");

        // Generate OTP for verification & save
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiration
        user.accessToken = newToken;
        await user.save();

        const host = req.get("host");
        const protocol = host && host.includes("localhost") ? "http" : "https";
        const link = `${protocol}://${req.get("host")}/api/v1/verify-user/${id}/${newToken}`;
        const name = `${user.firstName} ${user.lastName}`;
        await sendMail({
          email: user.email,
          html: generateLoginOTP((titleCase(name) ?? user.email), otp, link),
          subject: "RE-VERIFY YOUR ACCOUNT",
        });

        return res.send("Link expired. A new verification link has been sent to your email.");
      } else {
        // Token is valid, proceed to verify the user
        const userVerified = await UserService.updateUserById( id, { isVerified: true, status: "active", }, true );
         res.redirect("https://event-parcel.vercel.app/success");
      }
  } catch (error: unknown) {
    if (error instanceof Error) {
    return ErrorHandler.internalServerError(res, error.message)
  }
  }
};



// Function to handle User login
export const loginUser = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
      const { error } = validateU(req.body);
      if (error) {
        return ErrorHandler.badUserInput(res, error.details[0].message)
      }

      const { email, password } = req.body;

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Find user by email
      const user = await UserService.getUserByEmail(normalizedEmail);
      if (!user) {
          return ErrorHandler.notFound(res, "User not found", { email: normalizedEmail });
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

      
      // await sendMail({
      //     email: user.email,
      //     html: generateLoginOTP((titleCase(name) ?? user.email), newOtp, link),
      //     subject: "OTP for User Verification",
      // })
      // await user.save();

      // Send OTP via email
      await Promise.all([
        user.save(),
        sendMail({
          email: user.email,
          html: generateLoginOTP((titleCase(name) ?? user.email), newOtp, link),
          subject: "OTP for User Verification",
        })
      ]);


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

      // Check user role to block unauthorized user 
      if (user.role === "admin") 
        return ErrorHandler.forbidden(res, "Unauthorized user!")

      // Check if user is Suspended or Disabled 
      if (user.status === "suspended") {
        return ErrorHandler.forbidden(res, "Your account has been suspended. Please contact support.");
      }

      if (user.status === "disabled") {
        return ErrorHandler.forbidden(res, "Your account has been disabled. Please contact support.");
      }

      if (user.isDisabled) {
        return ErrorHandler.forbidden(res, "Your account has been disabled. Please contact support.");
      }

      // Generate a JWT token
      const token = generateToken({ userId: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email }, "1d");
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
//       const formattedData = {
//   _id: user._id,
//   hostId: user.role === "host" ? user._id : user.host,
//   hostEmail: user.role === "host" ? user.email : user.hostEmail,
//   firstName: toTitleCase(user.firstName),
//   lastName: toTitleCase(user.lastName),
//   email: user.email,
//   maskedEmail: user.maskedEmail,
//   phoneNumber: user.phoneNumber,
//   role: user.role as "host" | "cohost" | "admin" | "superAdmin",
//   isVerified: user.isVerified,
//   accessToken: user.accessToken ?? null,
//   refreshToken: user.refreshToken ?? [],
//   imageUrl: user.imageUrl ?? null,
//   imagePublicId: user.imagePublicId ?? null,
//   lastLogin: user.lastLogin ?? null,
//   isOtpVerified: user.isOtpVerified,
//   isDisabled: user.isDisabled,
//   createdAt: user.createdAt,
//   updatedAt: user.updatedAt,
// };

      // Remove sensitive data before responding
      const userObj = user.toObject();
      const { password: _password, otp, otpExpiry, otpAttempts, ...formattedData } = {
        ...userObj,
        hostId: user.role === "host" ? user._id : user.host,
        hostEmail: user.role === "host" ? user.email : user.hostEmail,
        firstName: toTitleCase(user.firstName),
        lastName: toTitleCase(user.lastName),
        email: user.email,
        maskedEmail: user.maskedEmail,
        phoneNumber: user.phoneNumber,
        role: user.role as "host" | "cohost" | "admin" | "superAdmin",
        isVerified: user.isVerified,
        accessToken: user.accessToken ?? null,
        refreshToken: user.refreshToken ?? [],
        imageUrl: user.imageUrl ?? null,
        imagePublicId: user.imagePublicId ?? null,
        lastLogin: user.lastLogin ?? null,
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



// Function to generate a new accessToken when it expires with the refreshToken
export const refreshTokenGenerate = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return ErrorHandler.notFound(res, 'No Refresh Token provided');
    }

    // Verify token integrity
    const decodedToken = await verifyToken(refreshToken);
    const decoded = decodedToken.decoded
    
    // Find user with the refresh token
    const userId = typeof decoded === 'string' ? decoded : decoded?.userId;
    if (!userId) {
      return ErrorHandler.forbidden(res, 'Invalid Refresh Token');
    }
    const user = await UserService.getUserById(userId);

    if (!user || !user.refreshToken) {
      return ErrorHandler.forbidden(res, 'Invalid Refresh Token');
    }

    // // Verify refresh token against stored hash
    // const isTokenValid = user.refreshToken.some(async (token) => {
    //   return await comparePassword(refreshToken, token);
    // });
    // if (!isTokenValid) {
    //   res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'strict' });
    //   user.refreshToken = user.refreshToken.filter(token => token !== refreshToken);
    //   await user.save();
    //   return ErrorHandler.forbidden(res, "Invalid Token. Please log in again.");
    // }

    // Verify refresh token against stored hash
    const isTokenValid = await Promise.all(
      user.refreshToken.map(async (token) => await comparePassword(refreshToken, token))
    ).then(results => results.includes(true));

    if (!isTokenValid) {
      res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'none' });
      user.refreshToken = user.refreshToken.filter(token => token !== refreshToken);
      await user.save();
      return ErrorHandler.forbidden(res, "Invalid Token. Please log in again.");
    }


    // Generate a new access token
    const accessToken = generateToken({ userId: user._id }, "1d");

    return res.status(200).json({ accessToken });

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
}


  // Function to get all User on the platform
  export const getAllUserProfiles = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const users = await UserService.getUsers();
        if (!users || users.length === 0) {
            return ErrorHandler.notFound(res, "No User found")
        }

        // Remove sensitive data for all User
        const userWithoutSensitiveData = users.map((user) => {
            const { password, otp, otpExpiry, otpAttempts, ...userWithoutSensitiveData } = user.toObject();
            return userWithoutSensitiveData;
        });

        return res.status(200).json({
            message: "User profiles fetched successfully",
            data: userWithoutSensitiveData,
        });

    } catch (error: unknown) {
        if (error instanceof Error) {
            return ErrorHandler.internalServerError(res, error.message)
        }
    }
};


// Function to get User Profile 
export const getUserProfile = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const user = await UserService.getUserByEmail(req.body.email.toLowerCase().trim());
        if (!user) {
            return ErrorHandler.notFound(res, "User not found", { email: req.body.email});
        }

        // Remove sensitive data before responding
        const { password, otp, otpExpiry, otpAttempts, ...userWithoutSensitiveData } = user.toObject();

        return res.status(200).json({ 
            message: "User Profile fetched successfully",
            data: userWithoutSensitiveData 
        });

    } catch (error: unknown) {
        if (error instanceof Error) {
            return ErrorHandler.internalServerError(res, error.message)
        }
    }
};


// Function to resend OTP for User
export const resendOTP = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return ErrorHandler.validationError(res, "Email is required!", { email: email })
    }

    // Find the user by email
    const user = await UserService.getUserByEmail(email.toLowerCase());
    if (!user) {
      return ErrorHandler.notFound(res, "User not found.", { email: email })
    }

    // Generate new OTP and set expiration time (15 minutes)
    const newOTP = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const token = generateToken({ userId: user._id }, "15m");

    // Update user with new OTP and reset attempts
    user.otp = newOTP;
    user.accessToken = token;
    user.otpExpiry = otpExpiry;
    user.otpAttempts = 0;
    await user.save();

    const host = req.get("host");
    const protocol = host && host.includes("localhost") ? "http" : "https";
    const link = `${protocol}://${req.get("host")}/api/v1/verify-user/${user._id}/${user.accessToken}`;

    // Send the email with the new OTP
    const name = `${user.firstName} ${user.lastName}`;
    const subject = "New OTP for Email Verification";
    const html = generateLoginOTP((titleCase(name) ?? user.email), newOTP, link);

    await sendMail({
        email: user.email,
        html,
        subject,
    });

    return res.status(200).json({
      message: "New OTP has been sent to your email.",
    });

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message)
    }
  }
};


// Function to resend OTP for User
export const resendOTPForgetPassword = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return ErrorHandler.validationError(res, "Email is required!", { email: email })
    }

    // Find the user by email
    const user = await UserService.getUserByEmail(email.toLowerCase());
    if (!user) {
      return ErrorHandler.notFound(res, "User not found.", { email: email })
    }

    // Generate new OTP and set expiration time (15 minutes)
    const newOTP = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const token = generateToken({ userId: user._id }, "15m");

    // Update user with new OTP and reset attempts
    user.otp = newOTP;
    user.accessToken = token;
    user.otpExpiry = otpExpiry;
    user.otpAttempts = 0;
    await user.save();

    const host = req.get("host");
    const protocol = host && host.includes("localhost") ? "http" : "https";
    const link = `${protocol}://${req.get("host")}/api/v1/verify-user/${user._id}/${user.accessToken}`;

    // Send the email with the new OTP
    const subject = "Kindly reset your password";
    const name = `${user.firstName} ${user.lastName}`;
    const html = resetNotification((titleCase(name) ?? user.email), newOTP);

    await sendMail({
        email: user.email,
        html,
        subject,
    });

    return res.status(200).json({
      message: "New OTP has been sent to your email.",
    });

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message)
    }
  }
};



// Function for User in case password is forgotten
export const forgotPassword = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
      const { error } = validateEmail(req.body);
      if (error) {
        return ErrorHandler.validationError(res, error.details[0].message)
      }
    const { email } = req.body;
    if (!email) {
      return ErrorHandler.validationError(res, "Please enter your email address!")
    }

    const user = await UserService.getUserByEmail(email.toLowerCase());
    if (!user) {
      return ErrorHandler.notFound(res, "User not found!", { email: email });
    }

    // Generate OTP for resetting password
    const otp = generateOTP();
    user.otp = otp;

    // OTP expires in 15 minutes
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);
    user.otpExpiry = otpExpiry;
    user.otpAttempts = 0; // Reset OTP attempts count

    // Send reset password email with OTP
    const subject = "Kindly reset your password";
    const name = `${user.firstName} ${user.lastName}`;
    const html = resetNotification((titleCase(name) ?? user.email), otp);

    await sendMail({
        email: user.email,
        html,
        subject,
    });

    // Update user with new OTP details
    await user.save();

    return res.status(200).json({
      message: "Kindly check your email for an OTP to reset your password.",
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message)
    }
  }
};



// Function to reset password for User
export const resetPassword = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
      const { error } = validateResetPassword(req.body);
      if (error) {
        return ErrorHandler.validationError(res, error.details[0].message)
      }
    const { email, password, confirmPassword } = req.body;
    if (!email || !password || !confirmPassword) {
      return ErrorHandler.validationError(res, "All fields are required!", {data: req.body})
    }

    const user = await UserService.getUserByEmail(email.toLowerCase());
    if (!user) {
      return ErrorHandler.notFound(res, "User not found.")
    }

    if (!user.isOtpVerified) {
      return ErrorHandler.validationError(res, "Please verify your OTP first.")
    }

    if (password !== confirmPassword) {
      return ErrorHandler.validationError(res, "Passwords do not match.")
    }

    const hashedPassword = await hashPassword(password, 12);

    // Update the user's password and reset OTP details
    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpAttempts = 0;
    user.isOtpVerified = false;

    // Save the updated user information to the database
    await user.save();

    return res.status(200).json({
      message: "Password reset successful.",
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message)
    }
  }
};



// Function to change password for User
export const changePassword = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
    const { error } = validateResetPassword(req.body);
    if (error) {
      return ErrorHandler.validationError(res, error.details[0].message);
    }

    const { email, currentPassword, password, confirmPassword } = req.body;

    if (!email || !password || !confirmPassword) {
      return ErrorHandler.validationError(res, "Email, password, and confirmPassword are required!", { data: req.body });
    }

    const user = await UserService.getUserByEmail(email.toLowerCase());
    if (!user) {
      return ErrorHandler.notFound(res, "User not found.", { email });
    }

    if (password !== confirmPassword) {
      return ErrorHandler.validationError(res, "Passwords do not match.");
    }

    // User is setting a password for the first time (e.g., signed up with Google)
    if (!user.password) {
      user.password = await hashPassword(password, 12);
      await user.save();

      return sendResponse(res, 200, "Password set successfully for the first time.");
    }

    // If user already has a password, require current password
    if (!currentPassword) {
      return ErrorHandler.validationError(res, "Current password is required.");
    }

    const isCurrentPasswordCorrect = await comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordCorrect) {
      return ErrorHandler.validationError(res, "Current password is not correct!");
    }

    const isSameAsOld = await comparePassword(password, user.password);
    if (isSameAsOld) {
      return ErrorHandler.validationError(res, "Please choose a password that's different from your current one.");
    }

    user.password = await hashPassword(password, 12);
    await user.save();

    return sendResponse(res, 200, "Password changed successfully.");

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};

// export const changePassword = async (req: Request, res: Response): Promise<Response | undefined> => {
//   try {
//       const { error } = validateResetPassword(req.body);
//       if (error) {
//         return ErrorHandler.validationError(res, error.details[0].message)
//       }
//     const { email, currentPassword, password, confirmPassword } = req.body;
//     if (!email ||!currentPassword || !password || !confirmPassword) {
//       return ErrorHandler.validationError(res, "All fields are required!", { data: req.body })
//     }

//     const user = await UserService.getUserByEmail(email.toLowerCase());
//     if (!user) {
//       return ErrorHandler.notFound(res, "User not found.", { email: email })
//     }

//     if (password !== confirmPassword) {
//       return ErrorHandler.validationError(res, "Passwords do not match.")
//     }

//     const hashedPassword = await hashPassword(password, 12);

//     // Check the current password
//     const checkCurrentPassword = await comparePassword(currentPassword, user.password);
//     if (!checkCurrentPassword) return ErrorHandler.validationError(res, "Current password not correct!");

//     const samePasswordAsOld = await comparePassword(currentPassword, hashedPassword);
//     if (samePasswordAsOld) return ErrorHandler.validationError(res, "Please choose a password that's different from your current one.")

//     user.password = hashedPassword;

//     await user.save();

//     return res.status(200).json({
//       message: "Password change successful.",
//     });
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       return ErrorHandler.internalServerError(res, error.message)
//     }
//   }
// };



// Function to sign out a User
export const signOut = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
  try {
    // Extract the user ID from the request object
    const userId = req.user?.userId; 
    if (!userId) {
      return ErrorHandler.validationError(res, "User ID not provided")
    }

    const { refreshToken } = req.cookies;

    if (refreshToken) {
      res.clearCookie("refreshToken");
    }

    const user = await UserService.getUserById(userId);
    if (!user) return ErrorHandler.notFound(res, "User not found", { user: user })

    user.accessToken = null;
    await user.save();

    res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'strict' });

    const name = user.firstName ? `${user.firstName} ${user.lastName}` : user.email;

    return res.status(201).json({
      message: `${toTitleCase(name)} has been successfully signed out.`,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message)
    }
  }
};


// Function to update User Profile
export const updateUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
  try {
    const { error } = validateUpdatedUser(req.body);
    if (error) {
      return ErrorHandler.validationError(res, error.details[0].message)
    }

    const { hostId } = req.params;
    const user = await UserService.getUserById(hostId);
    if (!user) return ErrorHandler.notFound(res, "User not found!")

    const userData = {
      firstName: req.body.firstName?.toLowerCase().trim() || user.firstName,
      lastName: req.body.lastName?.toLowerCase().trim() || user.lastName,
      email: req.body.email?.toLowerCase().trim() || user.email,
      phoneNumber: req.body.phoneNumber?.toLowerCase().trim() || user.phoneNumber,
      address: req.body.address || user.address,
      city: req.body.city || user.city,
      state: req.body.state || user.state,
      country: req.body.country || user.country,
    }

    const updatedUser = await UserService.updateUserById(hostId, userData, true);
    if (!updatedUser) return ErrorHandler.forbidden(res, "Unable to update user profile!", { updatedUser: updatedUser });

    // Respond with success message and updated profile data
    return res.status(200).json({
      message: "Your profile has been updated successfully",
      data: updatedUser
    });

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message)
    }
  }
};



// Function to upload a photo for User
export const uploadAPhoto = async (req: AuthenticatedRequest, res: Response) => {
  const filePath = req.file?.path;

  try {
    const { hostId } = req.params;
    const user = await UserService.getUserById(hostId);
    if (!user) return ErrorHandler.notFound(res, "User not found!")

    if (!req.file || !filePath) {
      return ErrorHandler.badUserInput(res, "No file was uploaded");
    }

    // Upload to Cloudinary using helper (which already deletes the file after upload)
    const { secure_url, public_id } = await uploadImage(filePath, user.imagePublicId || undefined, "Profile");

    // Update user with image info
    const updatedUser = await UserService.updateUserById(
      hostId,
      {
        imageUrl: secure_url,
        imagePublicId: public_id,
      },
      true
    );

    if (!updatedUser) {
      return ErrorHandler.badUserInput(res, "Unable to update User photo!");
    }

    return sendResponse(res, 200, "Photo successfully uploaded!", {imageUrl: updatedUser.imageUrl});

  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message)
  } finally {
    // Only delete if file still exists (in case uploadImage didn’t handle it)
    if (filePath && fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath).catch(() => null); // silently ignore if it fails
    }
  }
};



// Function to delete User Profile
export const deleteUserProfile = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
    const { id } = req.params;

    const user = await UserService.getUserById(id);
    if (!user) return ErrorHandler.notFound(res, "User not found")

    const deletedUser = await UserService.deleteUserById(id);
    if (!deletedUser) return ErrorHandler.validationError(res, "Unable to delete User profile")

    return res.status(200).json({ message: "User profile successfully deleted!" });

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};



// // Function to upload or overwrite an admin photo
// const uploadLogoToCloudinary = async (adminPicture: string, publicId?: string) => {
//     try {
//       if (publicId) {
//         // Overwrite existing image using public_id
//         return await cloudinary.uploader.upload(adminPicture, {
//           public_id: publicId,
//           overwrite: true,
//         });
//       } else {
//         // Upload new image
//         return await cloudinary.uploader.upload(adminPicture, {
//           folder: "Admin-Images",
//         });
//       }
//     } catch (error: unknown) {
//       if (error instanceof Error)
//       throw new Error("Error uploading photo to Cloudinary: " + error.message);
//     }
//   };
  
//   // Endpoint to upload an admin profile photo
//   export const uploadAPhoto = async (req: AuthenticatedRequest, res: Response) => {
//     try {
//       const userId = req.user?.userId
  
//       const admin = await getUserById(userId);
//       if (!admin) {
//         return res.status(404).json({
//           message: "Admin not found",
//         });
//       }
  
//       // Check if a file was uploaded
//       if (!req.file) {
//         return res.status(400).json({
//           message: "No file was uploaded",
//         });
//       }
  
//       // Path to the uploaded file
//       const imageFilePath = path.resolve(req.file.path);
  
//       // Check if the file exists before proceeding
//       if (!fs.existsSync(imageFilePath)) {
//         return res.status(400).json({
//           message: "Uploaded image not found",
//         });
//       }
  
//       // Upload the image to Cloudinary
//       let fileUploader: any;
//       try {
//         fileUploader = await uploadLogoToCloudinary(imageFilePath, admin.imagePublicId ?? undefined);
//         await fs.promises.unlink(imageFilePath); // Remove local file after upload
//       } catch (uploadError: unknown) {
//         if (uploadError instanceof Error)
//         return res.status(500).json({
//           message: "Error uploading profile photo: " + uploadError.message,
//         });
//       }
  
//       if (fileUploader) {
//         const updatedAdmin = await updateUserById(
//           userId,
//           {
//             imageUrl: fileUploader.secure_url,
//             imagePublicId: fileUploader.public_id,
//           },
//           { new: true }
//         );
  
//         if (!updatedAdmin) {
//           return res.status(400).json({
//             message: "Unable to update admin photo!",
//           });
//         }
  
//         return res.status(200).json({
//           message: "Photo successfully uploaded!",
//           ImageUrl: updatedAdmin.imageUrl,
//         });
//       } else {
//         return res.status(500).json({ message: "Failed to upload image" });
//       }
//     } catch (error: unknown) {
//         if (error instanceof Error)
//       return res.status(500).json({
//         message: "Internal server error: " + error.message,
//       });
//     } finally {
//       if (req.file && fs.existsSync(req.file.path)) {
//         fs.unlinkSync(path.resolve(req.file.path));
//       }
//     }
//   };



// // Function to add coHost to an Event New
// export const AddCoHostNew = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
//   try {
//       const { error } = validateCoHost(req.body);
//       if (error) {
//         return ErrorHandler.badUserInput(res, error.details[0].message);
//       }

//       const userId = req.user?.userId;
//       let eventId = req.cookies.eventId || req.body.eventId;
//       if (!eventId) return ErrorHandler.validationError(res, "Event ID is missing!");

//       const { firstName, lastName, email } = req.body;

//       // Normalize email
//       const normalizedEmail = email.toLowerCase().trim();

//       // check if the event exists 
//       const eventExists = await EventService.getEventById(eventId);
//       if (!eventExists) return ErrorHandler.notFound(res, "Event not found!");

//       // Check if the email already exists for that event!
//       const existingCoHost = await UserService.getUserByEmail(normalizedEmail);

//       // Check if CoHost Exist for that particular Event!
//       if (eventExists?.coHost.includes(existingCoHost._id)) {
//         return ErrorHandler.conflict(res, `CoHost already added to this Event!`);
//       }

//       // check for the host 
//       const checkHost = await UserService.getUserById(userId); 
//       if (!checkHost) return ErrorHandler.notFound(res, "Host not found!");  

//       // check if the Host already added more than 5 cohost 
//       if (eventExists?.coHost?.length >= 5) {
//         return ErrorHandler.validationError(res, "You can only add a maximum of 5 co-hosts for this event!");
//       }    

//       // Create the User
//       const newUser = await UserService.createUser({
//           firstName: firstName.toLowerCase().trim(),
//           lastName: lastName.toLowerCase().trim(),
//           email: normalizedEmail,
//           maskedEmail: maskEmail(normalizedEmail),
//           isVerified: false,  // Set to false by default until OTP is verified
//           password: "Abc12345@@",
//           role: "cohost",
//           hostEmail: checkHost.email,
//           coHostInviteStatus: "pending",
//       });


//       const hostName = toTitleCase(`${checkHost.firstName} ${checkHost.lastName}`);
//       const coHostName = toTitleCase(`${newUser.firstName} ${newUser.lastName}`);
//       const eventName = toTitleCase(eventExists.eventName);

//       const token = generateToken({ userId: newUser._id, hostName: hostName, coHostName: coHostName, eventName: eventName, hostEmail: checkHost.email }, "30m");
//       newUser.accessToken = token;
//       await newUser.save();

//       const host = req.get("host");
//       const protocol = host && host.includes("localhost") ? "http" : "https";
//       const acceptLink = `${protocol}://${req.get("host")}/api/v1/accept-cohost/${newUser._id}/${newUser.accessToken}`;
//       const declineLink = `${protocol}://${req.get("host")}/api/v1/decline-cohost/${newUser._id}/${newUser.accessToken}`;

//       const acceptUrl = acceptLink;  // Accept URL
//       const declineUrl = declineLink; // Decline URL

//       eventExists?.coHost.push(newUser._id),
//       await eventExists?.save();

//       // Send an email to CoHost to either Accept or Decline 
//         await sendMail({
//           email: newUser.email,
//           html: generateCoHostInvitationEmail(coHostName, hostName, eventName, acceptUrl, declineUrl),
//           subject: `${eventName} CoHost Invitation`,
//         });
      
//       return sendResponse(res, 201, "CoHost added successfully!", newUser);

//   } catch (error: any) {
//       return ErrorHandler.internalServerError(res, error.message)
//     }
// };

// export const AddCoHostNew = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
//   try {
//       const { error } = validateCoHost(req.body);
//       if (error) {
//         return ErrorHandler.badUserInput(res, error.details[0].message);
//       }

//       const userId = req.user?.userId;
//       let eventId = req.cookies.eventId || req.body.eventId;
//       if (!eventId) return ErrorHandler.validationError(res, "Event ID is missing!");

//       const { firstName, lastName, email } = req.body;

//       // Normalize email
//       const normalizedEmail = email.toLowerCase().trim();

//       // Check if the event exists 
//       const eventExists = await EventService.getEventById(eventId);
//       if (!eventExists) return ErrorHandler.notFound(res, "Event not found!");

//       // Check if the email already exists in the system
//       let coHost = await UserService.getUserByEmail(normalizedEmail) as ICoHost;

//       // If the coHost exists, check if they are already added to the event
//       if (coHost && eventExists?.coHost.includes(coHost._id as mongoose.Types.ObjectId)) {
//         return ErrorHandler.conflict(res, `CoHost already added to this Event!`);
//       }

//       // Check for the host 
//       const checkHost = await UserService.getUserByEmail(eventExists.hostEmail); 
//       if (!checkHost) return ErrorHandler.notFound(res, "Host not found!");  

//       // If the Host's email is used, block adding them as a CoHost
//       if (coHost && normalizedEmail === checkHost.email) {
//         return ErrorHandler.conflict(res, "You can't add the host as a co-host to this event!");
//       }

//       // If the Host exists, Block user from adding Host as a CoHost
//       if (checkHost && eventExists?.coHost.includes(checkHost._id as mongoose.Types.ObjectId)) {
//         return ErrorHandler.conflict(res, `You can't add a host as a co-host to this event!`);
//       }

//       // Check if the host has already added more than 5 co-hosts 
//       if (eventExists?.coHost?.length >= 5) {
//         return ErrorHandler.validationError(res, "You can only add a maximum of 5 co-hosts for this event!");
//       }

//       // If coHost doesn't exist, create a new one
//       if (!coHost) {
//           coHost = await UserService.createUser({
//               firstName: firstName.toLowerCase().trim(),
//               lastName: lastName.toLowerCase().trim(),
//               email: normalizedEmail,
//               maskedEmail: maskEmail(normalizedEmail),
//               isVerified: false,  // Set to false by default until OTP is verified
//               password: "Abc12345@@",
//               role: "cohost",
//               host: checkHost._id,
//               hostEmail: checkHost.email,
//               coHostInviteStatus: "pending",
//         }) as ICoHost;
//       }

//       if (coHost && coHost.role === "host" as string) {
//         coHost.isCoHostToo = true;
//         await coHost.save();
//       }

//       // Generate Token
//       const hostName = toTitleCase(`${checkHost.firstName} ${checkHost.lastName}`);
//       const coHostName = toTitleCase(`${coHost.firstName} ${coHost.lastName}`);
//       const eventName = toTitleCase(eventExists.eventName);

//       const token = generateToken(
//         { userId: coHost._id, hostName, coHostName, eventName, hostEmail: checkHost.email, eventId: eventExists._id }, 
//         "30m"
//       );

//       // coHost.role = "cohost";
//       coHost.accessToken = token;
//       await coHost.save();

//       const host = req.get("host");
//       const protocol = host && host.includes("localhost") ? "http" : "https";
//       const acceptLink = `${protocol}://${req.get("host")}/api/v1/accept-cohost/${coHost._id}/${coHost.accessToken}`;
//       const declineLink = `${protocol}://${req.get("host")}/api/v1/decline-cohost/${coHost._id}/${coHost.accessToken}`;

//       // Add coHost to event
//       eventExists.coHost.push(coHost._id as mongoose.Types.ObjectId);
//       await eventExists.save();

//       // Send an email to CoHost to either Accept or Decline 
//       await sendMail({
//         email: coHost.email,
//         html: generateCoHostInvitationEmail(coHostName, hostName, eventName, acceptLink, declineLink),
//         subject: `${eventName} CoHost Invitation`,
//       });

//       // ✅ Log activity
//       await ActivityLogService.logActivity({
//         user: (coHost as { _id: mongoose.Types.ObjectId })._id.toString(),
//         event: eventExists._id.toString(),
//         action: "Invited a CoHost",
//         entity: `${coHost.firstName} ${coHost.lastName}`,
//         entityType: "CoHost",
//         meta: {
//           entityId: (coHost as { _id: mongoose.Types.ObjectId })._id.toString(),
//           coHostEmail: coHost.email,
//           invitedBy: checkHost.email,
//           invitationStatus: coHost.coHostInviteStatus,
//         },
//       });
      
//       return sendResponse(res, 201, "CoHost added successfully!", coHost);

//   } catch (error: any) {
//       return ErrorHandler.internalServerError(res, error.message);
//   }
// };


// export const AddCoHostNew = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
//   try {
//     const { error } = validateCoHost(req.body);
//     if (error) return ErrorHandler.badUserInput(res, error.details[0].message);

//     const userId = req.user?.userId;
//     const eventId = req.body.eventId;
//     if (!eventId) return ErrorHandler.validationError(res, "Event ID is missing!");

//     const { firstName, lastName, email } = req.body;
//     const normalizedEmail = email.toLowerCase().trim();

//     const event = await EventService.getEventById(eventId);
//     if (!event) return ErrorHandler.notFound(res, "Event not found!");

//     const checkHost = await UserService.getUserByEmail(event.hostEmail);
//     if (!checkHost) return ErrorHandler.notFound(res, "Host not found!");

//     let coHost = await UserService.getUserByField({email: normalizedEmail}) as ICoHost;

//     // Prevent host email from being used as cohost
//     if (normalizedEmail === checkHost.email) {
//       return ErrorHandler.conflict(res, "You can't add the host as a co-host to this event!");
//     }

//     // Prevent duplicate cohost in the same event
//     const coHostUsers = await UserService.getUsers({ _id: { $in: event.coHost } });
//     const isDuplicate = coHostUsers.some((co: any) => co.email === normalizedEmail);
//     if (isDuplicate) {
//       return ErrorHandler.conflict(res, "CoHost already added to this Event!");
//     }

//     // Prevent adding a host who is already a cohost
//     if (checkHost && event.coHost.includes(checkHost._id as mongoose.Types.ObjectId)) {
//       return ErrorHandler.conflict(res, "You can't add a host as a co-host to this event!");
//     }

//     const uniqueCoHostEmails = new Set(event.coHost.map((co: any) => co.email));
//     if (uniqueCoHostEmails.size >= 5) {
//       return ErrorHandler.validationError(res, "You can only add a maximum of 5 co-hosts for this event!");
//     }

//     // Create user if not in system
//     if (!coHost) {
//       coHost = await UserService.createUser({
//         firstName: firstName.toLowerCase().trim(),
//         lastName: lastName.toLowerCase().trim(),
//         email: normalizedEmail,
//         maskedEmail: maskEmail(normalizedEmail),
//         isVerified: false,
//         password: "Abc12345@@",
//         role: "cohost",
//         host: checkHost._id,
//         hostEmail: checkHost.email,
//         coHostInviteStatus: "pending",
//       }) as ICoHost;
//     }

//     // If user is a host elsewhere, flag them
//     if (coHost.role === "host" as string) {
//       coHost.isCoHostToo = true;
//     }

//     // Generate access token
//     const hostName = toTitleCase(`${checkHost.firstName} ${checkHost.lastName}`);
//     const coHostName = toTitleCase(`${coHost.firstName} ${coHost.lastName}`);
//     const eventName = toTitleCase(event.eventName);

//     const token = generateToken(
//       {
//         userId: coHost._id,
//         hostName,
//         coHostName,
//         eventName,
//         hostEmail: checkHost.email,
//         eventId: event._id,
//       },
//       "30m"
//     );

//     coHost.accessToken = token;
//     await coHost.save();

//      // Generate invite token (for email link)
//     const inviteToken = crypto.randomBytes(32).toString("hex");

//     // Calculate expiration (e.g., 7 days from now)
//     const expiresAt = new Date();
//     expiresAt.setDate(expiresAt.getDate() + 7);

//     // Save invite details
//     await CoHostInvite.create({
//       coHost: coHost._id,
//       event: event._id,
//       host: checkHost._id,
//       token: inviteToken,
//       expiresAt: expiresAt, 
//     });

//     // Accept/Decline links
//     const hostHeader = req.get("host");
//     const protocol = hostHeader?.includes("localhost") ? "http" : "https";
//     const baseUrl = `${protocol}://${hostHeader}`;
//     const acceptLink = `${baseUrl}/api/v1/accept-cohost/${coHost._id}/${inviteToken}`;
//     const declineLink = `${baseUrl}/api/v1/decline-cohost/${coHost._id}/${inviteToken}`;

//     // Add to event
//     event.coHost.push(coHost._id as mongoose.Types.ObjectId);
//     await event.save();

//     // Update user's eventCoHosts array
//     const alreadyAdded = coHost.eventCoHosts?.some((e: any) => e.event.toString() === event._id.toString());

//     if (!alreadyAdded) {
//       coHost.eventCoHosts?.push({
//         event: event._id,
//         isCoHost: true,
//         joinedAt: new Date(),
//       } as IEventCoHosts);
//       await coHost.save();
//     }

//     // Send email
//     await sendMail({
//       email: coHost.email,
//       subject: `${eventName} CoHost Invitation`,
//       html: generateCoHostInvitationEmail(coHostName, hostName, eventName, acceptLink, declineLink),
//     });

//     // Log activity
//     await ActivityLogService.logActivity({
//       user: (coHost as { _id: mongoose.Types.ObjectId })._id.toString(),
//       event: event._id.toString(),
//       group: undefined,
//       action: "Invited a CoHost",
//       actionType: "Event",
//       entity: `${coHost.firstName} ${coHost.lastName}`,
//       entityType: "CoHost",
//       meta: {
//         entityId: (coHost as { _id: mongoose.Types.ObjectId })._id.toString(),
//         coHostEmail: coHost.email,
//         invitedBy: checkHost.email,
//         invitationStatus: coHost.coHostInviteStatus,
//       },
//     });

//     return sendResponse(res, 201, "CoHost added successfully!", coHost);

//   } catch (error: any) {
// // TEMPORARY CATCH FOR DUPLICATE KEY ERROR
//     if (error.code === 11000) {
//       const field = Object.keys(error.keyValue)[0];
//       const value = error.keyValue[field];
//       return ErrorHandler.conflict(res, `The ${field} "${value}" is already in use. Please try another.`,
//       );
//     }


//     return ErrorHandler.internalServerError(res, error.message);
//   }
// };

export const AddCoHostNew = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { error } = validateCoHost(req.body);
    if (error) {
      await session.abortTransaction();
      return ErrorHandler.badUserInput(res, error.details[0].message);
    }

    const userId = req.user?.userId;
    const eventId = req.body.eventId;
    if (!eventId) {
      await session.abortTransaction();
      return ErrorHandler.validationError(res, "Event ID is missing!");
    }

    const { firstName, lastName, email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const event = await EventService.getEventById(eventId);
    if (!event) {
      await session.abortTransaction();
      return ErrorHandler.notFound(res, "Event not found!");
    }

    const checkHost = await UserService.getUserByEmail(event.hostEmail);
    if (!checkHost) {
      await session.abortTransaction();
      return ErrorHandler.notFound(res, "Host not found!");
    }

    let coHost = await UserService.getUserByField({email: normalizedEmail}) as ICoHost;

    // Prevent host email from being used as cohost
    if (normalizedEmail === checkHost.email) {
      await session.abortTransaction();
      return ErrorHandler.conflict(res, "You can't add the host as a co-host to this event!");
    }

    // Prevent duplicate cohost in the same event
    const coHostUsers = await UserService.getUsers({ _id: { $in: event.coHost } });
    const isDuplicate = coHostUsers.some((co: any) => co.email === normalizedEmail);
    if (isDuplicate) {
      await session.abortTransaction();
      return ErrorHandler.conflict(res, "CoHost already added to this Event!");
    }

    // Prevent adding a host who is already a cohost
    if (checkHost && event.coHost.includes(checkHost._id as mongoose.Types.ObjectId)) {
      await session.abortTransaction();
      return ErrorHandler.conflict(res, "You can't add a host as a co-host to this event!");
    }

    const uniqueCoHostEmails = new Set(event.coHost.map((co: any) => co.email));
    if (uniqueCoHostEmails.size >= 5) {
      await session.abortTransaction();
      return ErrorHandler.validationError(res, "You can only add a maximum of 5 co-hosts for this event!");
    }

    // Create user if not in system - WITH SESSION
    if (!coHost) {
      // ⚠️ Use createUser with session if your service supports it
      // Otherwise, create directly with Model
      const User = mongoose.model('User'); // Adjust to your User model
      const [newUser] = await User.create([{
        firstName: firstName.toLowerCase().trim(),
        lastName: lastName.toLowerCase().trim(),
        email: normalizedEmail,
        maskedEmail: maskEmail(normalizedEmail),
        isVerified: false,
        password: "Abc12345@@",
        role: "cohost",
        host: checkHost._id,
        hostEmail: checkHost.email,
        coHostInviteStatus: "pending", // ✅ Set to pending initially
      }], { session }); // ✅ CRITICAL: Include session
      
      coHost = newUser as ICoHost;
    } else {
      // ✅ If user exists, reset their invite status to pending
      coHost.coHostInviteStatus = "pending";
    }

    // If user is a host elsewhere, flag them
    if (coHost.role === "host" as string) {
      coHost.isCoHostToo = true;
    }

    // Generate access token
    const hostName = toTitleCase(`${checkHost.firstName} ${checkHost.lastName}`);
    const coHostName = toTitleCase(`${coHost.firstName} ${coHost.lastName}`);
    const eventName = toTitleCase(event.eventName);

    const token = generateToken(
      {
        userId: coHost._id,
        hostName,
        coHostName,
        eventName,
        hostEmail: checkHost.email,
        eventId: event._id,
      },
      "30m"
    );

    coHost.accessToken = token;
    await coHost.save({ session });

    // Generate invite token (for email link)
    const inviteToken = crypto.randomBytes(32).toString("hex");

    // Calculate expiration (e.g., 7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invite with session
    await CoHostInvite.create([{
      coHost: coHost._id,
      event: event._id,
      host: checkHost._id,
      token: inviteToken,
      expiresAt: expiresAt,
    }], { session });

    // Accept/Decline links
    const hostHeader = req.get("host");
    const protocol = hostHeader?.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${hostHeader}`;
    const acceptLink = `${baseUrl}/api/v1/accept-cohost/${coHost._id}/${inviteToken}`;
    const declineLink = `${baseUrl}/api/v1/decline-cohost/${coHost._id}/${inviteToken}`;

    // Add to event
    event.coHost.push(coHost._id as mongoose.Types.ObjectId);
    await event.save({ session });

    // Update user's eventCoHosts array
    const alreadyAdded = coHost.eventCoHosts?.some((e: any) => e.event.toString() === event._id.toString());

    if (!alreadyAdded) {
      coHost.eventCoHosts?.push({
        event: event._id,
        isCoHost: true,
        joinedAt: new Date(),
      } as IEventCoHosts);
      await coHost.save({ session });
    }

    // Send email
    const emailResult = await sendMail({
      email: coHost.email,
      subject: `${eventName} CoHost Invitation`,
      html: generateCoHostInvitationEmail(coHostName, hostName, eventName, acceptLink, declineLink),
    });

    if (!emailResult?.success) {
      throw new Error(`Email sending failed: ${emailResult?.message}`);
    }

    // ✅ Commit transaction only if email succeeds
    await session.commitTransaction();

    // Log activity
    await ActivityLogService.logActivity({
      user: (coHost as { _id: mongoose.Types.ObjectId })._id.toString(),
      event: event._id.toString(),
      group: undefined,
      action: "Invited a CoHost",
      actionType: "Event",
      entity: `${coHost.firstName} ${coHost.lastName}`,
      entityType: "CoHost",
      meta: {
        entityId: (coHost as { _id: mongoose.Types.ObjectId })._id.toString(),
        coHostEmail: coHost.email,
        invitedBy: checkHost.email,
        invitationStatus: coHost.coHostInviteStatus,
      },
    });

    return sendResponse(res, 201, "CoHost added successfully!", coHost);

  } catch (error: any) {
    // 🔄 Rollback all database changes
    await session.abortTransaction();

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      return ErrorHandler.conflict(res, `The ${field} "${value}" is already in use. Please try another.`);
    }

    return ErrorHandler.internalServerError(res, error.message);
  } finally {
    session.endSession();
  }
};




// // Function to accept Host Invite to be a CoHost
// export const acceptInvite = async (req: Request, res: Response): Promise<Response | undefined> => {
//   try {
//     const { id, token } = req.params;

//     const coHost = await UserService.getUserById(id);
//     if (!coHost) return ErrorHandler.notFound(res, "user not found");

//     if (coHost?.coHostInviteStatus === "cancel") {
//       return ErrorHandler.forbidden(res, "This invite has already been cancelled by the Host!")
//     }

//     if (coHost?.coHostInviteStatus === "accepted") {
//       return ErrorHandler.forbidden(res, "This invite has already been accepted by the coHost!")
//     }

//     if (coHost?.coHostInviteStatus === "declined") {
//       return ErrorHandler.forbidden(res, "This invite has already been declined by the coHost!")
//     }

//     // Verify the token
//     const decodedToken = await verifyToken(token);
//       if (!decodedToken.valid) {
//         return res.send("Link expired. Ask Host to resend invite.");
//       } else {
//         // Token is valid, proceed to complete registration for the cohost
//         const updateCoHost = await UserService.updateUserById( id, { isVerified: true, coHostInviteStatus: "accepted", }, true );
//         if (!updateCoHost) ErrorHandler.validationError(res, "Unable to update the cohost data!");

//         const decoded = decodedToken.decoded as JwtPayload & { hostName: string, coHostName: string, eventName: string, hostEmail: string };
//         const hostName = decoded.hostName;
//         const coHostName = decoded.coHostName;
//         const eventName = decoded.eventName;
  
//         // Send an email to the Host notifying the Host of the event coHost acceptance
//         await sendMail({
//             email: decoded.hostEmail,
//             html: generateHostAcceptedEmail(hostName, coHostName, eventName),
//             subject: `${eventName} CoHost Invitation`,
//         });
//          res.redirect(`https://event-parcel.vercel.app/signup?userId=${id}`);
//       }

//   } catch (error: any) {
//     return ErrorHandler.internalServerError(res, error.message)
//   }
// }


// // Function to decline Host Invite to be a CoHost
// export const declineInvite = async (req: Request, res: Response): Promise<Response | undefined> => {
//   try {
//     const { id, token } = req.params;

//     const coHost = await UserService.getUserById(id);
//     if (!coHost) return ErrorHandler.notFound(res, "user not found");

//     if (coHost?.coHostInviteStatus === "cancel") {
//       return ErrorHandler.forbidden(res, "This invite has already been cancelled by the Host!")
//     }

//     if (coHost?.coHostInviteStatus === "accepted") {
//       return ErrorHandler.forbidden(res, "This invite has already been accepted by the coHost!")
//     }

//     if (coHost?.coHostInviteStatus === "declined") {
//       return ErrorHandler.forbidden(res, "This invite has already been declined by the coHost!")
//     }

//     // Verify the token
//     const decodedToken = await verifyToken(token);
//       if (!decodedToken.valid) {
//         return res.send("<h3>Link expired.</h3><script>setTimeout(() => window.close(), 3000);</script>");
//       } else {

//         const decoded = decodedToken.decoded as JwtPayload & { hostName: string, coHostName: string, eventName: string, hostEmail: string };
//         const hostName = decoded.hostName;
//         const coHostName = decoded.coHostName;
//         const eventName = decoded.eventName;
  
//         // Send an email to the Host notifying the Host of the event coHost acceptance
//         await sendMail({
//             email: decoded.hostEmail,
//             html: generateHostDeclinedEmail(hostName, coHostName, eventName),
//             subject: `${eventName} CoHost Invitation`,
//         });

//         // Token is valid, proceed to delete the cohost account
//         await UserService.deleteUserById(id);

//         return res.send("<h3>Invite declined successfully!</h3><script>setTimeout(() => window.close(), 3000);</script>");
//       }

//   } catch (error: any) {
//     return ErrorHandler.internalServerError(res, error.message)
//   }
// }



const appUrl = process.env.CLIENT_URL || "https://eventparcel.com";
const appUrl2 = process.env.CLIENT_URL || "https://app.eventparcel.com";


// Function to accept Host Invite to be a CoHost
export const acceptInvite = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
    const { id, token } = req.params;

    // First check the invite exists and is valid
    const invite = await CoHostInviteService.getCoHostInvite(token) as any;
    if (!invite) return res.send(emailInvitePage("error", "Invalid or expired invite link.", "Close", appUrl));

    // Check if invite has expired
    if (new Date() > invite.expiresAt) {
      return res.send(emailInvitePage("error", "This invite has expired.", "Close", appUrl));
    }

    const coHost = await UserService.getUserById(id) as ICoHost;
    if (!coHost) return ErrorHandler.notFound(res, "User not found");

    if (coHost?.coHostInviteStatus === "canceled") {
      return res.send(emailInvitePage("error", "This invite has already been cancelled by the Host!", "Close", appUrl));
    }

    if (coHost?.coHostInviteStatus === "accepted") {
      return res.send(emailInvitePage("error", "This invite has already been accepted by the CoHost!", "Close", appUrl));
    }

    if (coHost?.coHostInviteStatus === "declined") {
      return res.send(emailInvitePage("error", "This invite has already been declined by the CoHost!", "Close", appUrl));
    }

    const eventDateTime = new Date(`${invite.event.date}T${invite.event.time}`);
    if (new Date() > eventDateTime) {
      return res.send(
        emailInvitePage("error", "This event has already passed.", "Close", appUrl)
      );
    }

    // Token is valid, proceed to complete registration for the CoHost
    // const updateCoHost = await UserService.updateUserById(id, { isVerified: true, coHostInviteStatus: "accepted", status: "active" }, true);
    coHost.isVerified = true;
    coHost.coHostInviteStatus = "accepted";
    coHost.status = "active"
    await coHost.save();

    const hostName = `${invite.host.firstName} ${invite.host.lastName}`;
    const coHostName = `${invite.coHost.firstName} ${invite.coHost.lastName}`;
    const eventName = invite.event.eventName;
    const hostEmail = invite.host.email;
    const eventId = invite.event._id;

    // Send an email to the Host notifying them of the acceptance
    await sendMail({
      email: hostEmail,
      html: generateHostAcceptedEmail(hostName, coHostName, eventName),
      subject: `${eventName} CoHost Invitation`,
    });

        // ✅ Log activity for accepting invite
        await ActivityLogService.logActivity({
          user: id,
          event: eventId,
          group: undefined,
          action: "Accepted CoHost Invitation",
          actionType: "Event",
          entity: coHostName,
          entityType: "CoHost",
          meta: {
            coHostEmail: coHost.email,
            acceptedAt: new Date(),
            invitedBy: hostEmail,
          },
        });

    // Now delete the invite link details
    await CoHostInviteService.deleteCoHostInvite(token);

    return res.send(emailInvitePage("success", "You have successfully accepted the CoHost invite!", "Continue", `${appUrl2}/complete-cohost/${id}`));
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
};




// Function to decline Host Invite to be a CoHost
export const declineInvite = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
    const { id, token } = req.params;

    // First check the invite exists and is valid
    const invite = await CoHostInviteService.getCoHostInvite(token) as any;
    if (!invite) {
      return res.send(emailInvitePage("error", "Invalid or expired invite link.", "Close", appUrl));
    }

    // Check if invite has expired
    if (new Date() > invite.expiresAt) {
      return res.send(emailInvitePage("error", "This invite has expired.", "Close", appUrl));
    }

    const coHost = await UserService.getUserById(id) as ICoHost;
    if (!coHost) return ErrorHandler.notFound(res, "User not found");

    if (coHost?.coHostInviteStatus === "canceled") {
      return res.send(emailInvitePage("error", "This invite has already been cancelled by the Host!", "Close", appUrl));
    }

    if (coHost?.coHostInviteStatus === "accepted") {
      return res.send(emailInvitePage("error", "This invite has already been accepted by the CoHost!", "Close", appUrl));
    }

    if (coHost?.coHostInviteStatus === "declined") {
      return res.send(emailInvitePage("error", "This invite has already been declined by the CoHost!", "Close", appUrl));
    }

    // Verify the token
    const decodedToken = await verifyToken(token);
    if (!decodedToken.valid) {
      return res.send(emailInvitePage("error", "Link expired. Ask the Host to resend the invite.", "Close", appUrl));
    }

    const hostName = `${invite.host.firstName} ${invite.host.lastName}`;
    const coHostName = `${invite.coHost.firstName} ${invite.coHost.lastName}`;
    const eventName = invite.event.eventName;
    const hostEmail = invite.host.email;
    const eventId = invite.event._id;

    const eventDateTime = new Date(`${invite.event.date}T${invite.event.time}`);
    if (new Date() > eventDateTime) {
      return res.send(
        emailInvitePage("error", "This event has already passed.", "Close", appUrl)
      );
    }

    // Send an email to the Host notifying them of the decline
    await sendMail({
      email: hostEmail,
      html: generateHostDeclinedEmail(hostName, coHostName, eventName),
      subject: `${eventName} CoHost Invitation`,
    });

    // Find the Event the coHost belongs to
    const event = await EventService.getEventById(eventId);
    if (!event) return ErrorHandler.validationError(res, "Event not found!");

    // Ensure coHostId exists in Event.coHost array
    const coHostIndex = event.coHost.findIndex((coHost) => coHost._id.toString() === id);
    if (coHostIndex === -1) {
      return ErrorHandler.validationError(res, "This user is not a CoHost for you!");
    }

    // Remove the CoHost from the Event's coHost array
    event.coHost.splice(coHostIndex, 1);
    await event.save();

    // Remove the Event from the coHost's eventCoHosts list
    coHost.eventCoHosts = coHost.eventCoHosts?.filter(
      (e: any) => e.event.toString() !== eventId
    );
    await coHost.save();

        // ✅ Log activity for declining invite
        await ActivityLogService.logActivity({
          user: id,
          event: eventId,
          group: undefined,
          action: "Declined CoHost Invitation",
          actionType: "Event",
          entity: coHostName,
          entityType: "CoHost",
          meta: {
            coHostEmail: coHost.email,
            declinedAt: new Date(),
            invitedBy: hostEmail,
          },
        });

    return res.send(emailInvitePage("error", "You have successfully declined the CoHost invite!", "Close", appUrl));
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
};



// Function to Cancel Invite for cohost
export const cancelInvite = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
  try {
    const { coHostId } = req.body;

    const coHost = await UserService.getUserById(coHostId) as ICoHost;
    if (!coHost) return ErrorHandler.notFound(res, "CoHost not found!");

    if (coHost?.coHostInviteStatus === "accepted") {
      return ErrorHandler.forbidden(res, "This invite has already been accepted by the coHost!")
    }

    // Update status to canceled
    await UserService.updateUserById(coHostId, { coHostInviteStatus: "canceled" });

    return sendResponse(res, 200, "CoHost invite has been canceled!");
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message)
  }
};



// Function to disable or enable a co-host for an event
export const disableCoHost = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
  try {
    
    const { coHostId } = req.params;
    const { status } = req.body;

    // Validate coHostId
    if (!coHostId) {
      return ErrorHandler.badUserInput(res, "Co-host ID is required.");
    }

    // Validate status
    if (typeof status !== "boolean") {
      return ErrorHandler.badUserInput(res, "Status must be a boolean value (true or false).");
    }

    // Find the co-host
    const coHost = await UserService.getUserById(coHostId) as ICoHost;
    if (!coHost) {
      return ErrorHandler.notFound(res, "Co-host not found.");
    }

    // Check if the co-host has accepted the invite
    if (coHost.coHostInviteStatus !== "accepted") {
      return ErrorHandler.forbidden(res, "Co-host has not accepted the invite.");
    }

    // Update the co-host's disabled status
    await UserService.updateUserById(coHostId, { isDisabled: status });

    return sendResponse(res, 200, `Co-host has been ${status ? "disabled" : "enabled"} successfully.`);
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
};



// Function to update a co-host
export const updateCoHost = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
  try {
    
    const { coHostId } = req.params;

    // Validate coHostId
    if (!coHostId) {
      return ErrorHandler.badUserInput(res, "Co-host ID is required.");
    }


    // Find the co-host
    const coHost = await UserService.getUserById(coHostId) as ICoHost;
    if (!coHost) {
      return ErrorHandler.notFound(res, "Co-host not found.");
    }

    // Check if the co-host has accepted the invite
    if (coHost.coHostInviteStatus !== "accepted") {
      return ErrorHandler.forbidden(res, "Co-host has not accepted the invite.");
    }

    const updatedData = {
      firstName: req.body.firstName?.toLowerCase().trim() ?? coHost.firstName, 
      lastName: req.body.lastName?.toLowerCase().trim() ?? coHost.lastName, 
      email: req.body.email?.toLowerCase().trim() ?? coHost.email,
      phoneNumber: req.body.phoneNumber?.trim() ?? coHost.phoneNumber,
    }

    // Update the co-host's profile
    const updateCoHost = await UserService.updateUserById(coHostId, updatedData) as ICoHost;
    if (!updateCoHost) return ErrorHandler.validationError(res, "Unable to update co-host profile!");

    const formattedCoHost = {
      _id: updateCoHost._id,
      firstName: toTitleCase(updateCoHost.firstName),
      lastName: toTitleCase(updateCoHost.lastName),
      email: updateCoHost.email,
      phoneNumber: updateCoHost.phoneNumber, 
      role: updateCoHost.role,
      coHostInviteStatus: updateCoHost.coHostInviteStatus,
      imageUrl: updateCoHost.imageUrl,
      isDisabled: updateCoHost.isDisabled,
    }

    return sendResponse(res, 200, `Co-host profile successfully updated!`, formattedCoHost);
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
};



// Get all CoHosts for an Event by a Host
export const getAllCoHosts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.userId;
    if (!userId) return ErrorHandler.unauthenticated(res, "Not authenticated! Please log in")

    let eventId = req.cookies.eventId || req.params.eventId;
    if (!eventId) return ErrorHandler.validationError(res, "Event ID is missing!");

    // Fetch for CoHosts that belongs to an Event
    const event = await EventService.getEventById(eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found!" });
    }

    const viewCoHosts: any = event?.coHost;

    const formatCoHosts = viewCoHosts.map((coHost: any) => ({
      _id: coHost._id,
      firstName: toTitleCase(coHost.firstName),
      lastName: toTitleCase(coHost.lastName),
      email: coHost.email,
      phoneNumber: coHost.phoneNumber, 
      role: coHost.role,
      hostEmail: coHost.hostEmail,
      coHostInviteStatus: coHost.coHostInviteStatus,
      imageUrl: coHost.imageUrl,
  }));

    return sendResponse(res, 200, "CoHost successfully fetched!", formatCoHosts);

  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message)
  }
};



// Get all CoHosts for an Event by a Host
// export const getAllCoHostsForHost = async (req: AuthenticatedRequest, res: Response) => {
//   try {
//     const userId = req.user.userId;
//     if (!userId) return ErrorHandler.unauthenticated(res, "Not authenticated! Please log in")

//     // let eventId = req.cookies.eventId || req.params.eventId;
//     // if (!eventId) return ErrorHandler.validationError(res, "Event ID is missing!");

//     // // Fetch for CoHosts that belongs to an Event
//     // const event = await EventService.getEventById(eventId);

//     // if (!event) {
//     //   return res.status(404).json({ message: "Event not found!" });
//     // }

//     const viewCoHosts = await UserService.getUsers({ host: userId, role: "cohost" });

//     const formatCoHosts = viewCoHosts.map((coHost: any) => ({
//       _id: coHost._id,
//       firstName: toTitleCase(coHost.firstName),
//       lastName: toTitleCase(coHost.lastName),
//       email: coHost.email,
//       phoneNumber: coHost.phoneNumber, 
//       role: coHost.role,
//       hostEmail: coHost.hostEmail,
//       coHostInviteStatus: coHost.coHostInviteStatus,
//       imageUrl: coHost.imageUrl,
//   }));

//     return sendResponse(res, 200, "CoHost successfully fetched!", formatCoHosts);

//   } catch (error: any) {
//     return ErrorHandler.internalServerError(res, error.message)
//   }
// };


// Get all CoHosts for an Event by a Host
export const getAllCoHostsForHost = async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return ErrorHandler.unauthenticated(res, "Not authenticated! Please log in");

    const cohosts = await EventService.getAllCohostsByHostId(userId);

    const formatted = cohosts.map((c: any) => ({
      ...c,
      firstName: toTitleCase(c.firstName),
      lastName: toTitleCase(c.lastName),
    }));

    return sendResponse(res, 200, "CoHosts successfully fetched!", formatted);
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
};



// Function to delete a CoHost for an Event by a Host
export const removeCoHost = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { coHostId } = req.params;
    const userId = req.user.userId;

    let eventId = req.cookies.eventId || req.params.eventId;
    if (!eventId) return ErrorHandler.validationError(res, "Event ID is missing!");
    
    if (!userId) return ErrorHandler.unauthenticated(res, "Not authenticated! Please log in");

    // Fetch the CoHost and Host
    const coHost = await UserService.getUserById(coHostId);
    if (!coHost) return ErrorHandler.validationError(res, "Co-host not found!");

    const host = await UserService.getUserById(userId);
    if (!host) return ErrorHandler.validationError(res, "Host not found!");

    const event = await EventService.getEventById(eventId);
    if (!event) return ErrorHandler.validationError(res, "Event not found!");

    // Ensure coHostId exists in Event.coHost array
    const coHostIndex = event.coHost.findIndex((coHost) => coHost._id.toString() === coHostId);
    if (coHostIndex === -1) {
      return ErrorHandler.validationError(res, "This user is not a CoHost for you!");
    }

    // Remove the CoHost from the Event's coHost array
    event.coHost.splice(coHostIndex, 1);
    await event.save();

    // Also remove the Event from the CoHost's eventCoHosts list
    coHost.eventCoHosts = coHost.eventCoHosts?.filter(
      (e: any) => e.event.toString() !== eventId
    );
    await coHost.save();

    return sendResponse(res, 200, "CoHost removed from event successfully!");

  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message)
  }
};



// // Function to display User Profile
//   export const userProfile = async (req: Request, res: Response): Promise<Response | undefined> => {
//     try {
//         const token = req.body.token;

//         // If there's still no token, return an unauthorized response
//         if (!token) {
//             return res.status(401).json({ message: "Unauthorized: No token provided" });
//         }
        
//         // Verify and decode the token.
//         // Assumes the token payload includes a property `_id`
//         const tokenData = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload & { _id: string };
        
//         // Query the user using the id from the token payload
//         const user = await User.findById(tokenData.userId).select("-password, -otp, -otpExpiry, -otpAttempts");
        
//         if (!user) {
//             return res.status(404).json({ message: "User not found" });
//         }

//         return res.status(200).json(user);

// } catch (error: unknown) {
//     console.log(error);

//     if (error instanceof jwt.JsonWebTokenError) {
//         return ErrorHandler.unauthenticated(res, "Invalid or expired token, please log in again");
//     }

//     if (error instanceof Error) {
//         return ErrorHandler.internalServerError(res, error.message);
//     }
// }
// };
// Function to display User Profile
export const userProfile = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const { token } = req.body;

        // If no token is provided, return an unauthorized response
        if (!token) {
            return ErrorHandler.unauthenticated(res, "Unauthorized: No token provided");
        }

        // Verify and decode the token
        const tokenData = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload & { _id: string };

        // Query the user using the ID from the token payload
        const user = await UserService.getUserById(tokenData.userId);

        if (!user) {
            return ErrorHandler.notFound(res, "User not found");
        }

        // Remove sensitive data before responding
        // const { password, otp, otpExpiry, otpAttempts, ...userWithoutSensitiveData } = user.toObject();
        const formattedData = {
          _id: user._id,
          hostId: user.role === "host" ? user._id : user?.host?._id,
          hostEmail: user.role === "host" ? user.email : user.hostEmail,
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

        return res.status(200).json(formattedData);

    } catch (error: unknown) {
        console.log(error);

        if (error instanceof jwt.JsonWebTokenError) {
            return ErrorHandler.unauthenticated(res, "Invalid or expired token, please log in again");
        }

        if (error instanceof Error) {
            return ErrorHandler.internalServerError(res, error.message);
        }
    }
};


// Function to get User details by ID
export const getUserDetails = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
      const { userId } = req.params;
      if (!userId) return ErrorHandler.badUserInput(res, "User ID is required!");

      const user = await UserService.getUserById(userId);
      if (!user) {
          return ErrorHandler.notFound(res, "User not found", { email: req.body.email});
      }

      // Remove sensitive data before responding
      const { password, otp, otpExpiry, otpAttempts, ...userWithoutSensitiveData } = user.toObject();

      return res.status(200).json({ 
          message: "User Profile fetched successfully",
          data: userWithoutSensitiveData 
      });

  } catch (error: unknown) {
      if (error instanceof Error) {
          return ErrorHandler.internalServerError(res, error.message)
      }
  }
};



// Utility function to normalize phone numbers
const normalizePhoneNumber = (phone: string): string => {
  return phone.startsWith("+") ? phone.slice(1) : phone;
};

// Function to update User Profile
export const updateUserDetails = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
    const { error } = validateUpdatedUser(req.body);
    if (error) {
      return ErrorHandler.validationError(res, error.details[0].message);
    }

    const { userId } = req.params;
    if (!userId) return ErrorHandler.badUserInput(res, "User ID is required!");

    const user = await UserService.getUserById(userId);
    if (!user) return ErrorHandler.notFound(res, "User not found!");

    let hashedPassword: string | undefined;
    let phoneValidationResult: any;

    const newPassword = req.body.password?.trim();
    if (newPassword) {
      hashedPassword = await hashPassword(newPassword, 12);
    }

    const phoneNumber = req.body.phoneNumber?.trim();
    if (phoneNumber) {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      phoneValidationResult = validatePhoneNumber(normalizedPhone);
      if (!phoneValidationResult.success) {
        return ErrorHandler.badUserInput(res, phoneValidationResult.message, { phoneNumber: normalizedPhone });
      }
    }

    // Construct user data only with updated values
    const userData: Partial<typeof user> = {
      firstName: req.body.firstName?.trim().toLowerCase() ?? user.firstName,
      lastName: req.body.lastName?.trim().toLowerCase() ?? user.lastName,
      phoneNumber: phoneValidationResult?.phoneNumber ?? user.phoneNumber,
      isVerified: true, 
    };

    if (hashedPassword) {
      userData.password = hashedPassword;
    }

    const updatedUser = await UserService.updateUserById(userId, userData, true);
    if (!updatedUser) return ErrorHandler.forbidden(res, "Unable to update user profile!");

    return res.status(200).json({
      message: "Your profile has been updated successfully",
      data: updatedUser,
    });

  } catch (error) {
    return ErrorHandler.internalServerError(res, error instanceof Error ? error.message : "An unexpected error occurred");
  }
};



// Function update Host User Status
export const updateHostUserStatus = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
  try {
    const { userId, status } = req.body;

    if (!userId || !status) {
      return ErrorHandler.badUserInput(res, "User ID and status are required.");
    }

    // Validate the status value
    const validStatuses = ["active", "inactive", "suspended", "disabled"];
    if (!validStatuses.includes(status)) {
      return ErrorHandler.badUserInput(res, "Invalid status value. Valid values are: active, inactive, suspended.");
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

    const message = status === "active" || status === "inactive" ? `This account has been ${status === "active" ? "activated" : "deactivated"}.` : `This account has been ${status}.`;

    return sendResponse(res, 200, message, updatedUser);

  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
}