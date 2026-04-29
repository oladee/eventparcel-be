import express, { Request, Response } from "express";
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import fs from "fs";
import libphonenumber from "google-libphonenumber";
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import cloudinary from "../middleware/cloudinary";
import { VerifyTokenResult } from "../interfaces/interface";
import ms, { StringValue } from 'ms';
import dotenv from "dotenv";
import crypto from 'crypto';
import { ErrorHandler } from '../utils/errorHandler/errorHandler';
import { IOrder, IOrderItem, IPackageDeliveryInfo } from "../interfaces/modelInterface";
import { ObjectId, Types } from "mongoose";
import redisClient from "../config/redisConfig";
import { ExchangeRateModel } from "../models/exchangeRateModel";
dotenv.config();

const SECRET_KEY: string = process.env.JWT_SECRET || 'your_secret_key';


// Helps mask the email
export const maskEmail = (email: string): string => {
  const [name, domain] = email.split("@");

  if (!name || !domain) {
    throw new Error("Invalid email format");
  }

  // Ensure at least 1 visible character
  const visiblePart = name.slice(0, Math.min(5, name.length)); // If name is shorter than 5, keep all
  const maskedPart = name.length > 5 ? "*".repeat(name.length - 5) : ""; // Only mask if longer than 5

  return `${visiblePart}${maskedPart}@${domain}`;
};


interface ValidationResult {
  success: boolean;
  phoneNumber?: string;
  countryCode?: number;
  region?: string;
  formatted?: string;
  message?: string;
}

// Validate phone number against the country code   
export const validatePhoneNumber = (phoneNumber: string): ValidationResult => {
  if (!phoneNumber) {
    return { success: true }; // No phone number provided, so it's valid by default.
  }

  const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
  const regionDisplay = new Intl.DisplayNames(['en'], { type: 'region' });

  try {
    // Ensure the phone number starts with "+"
    if (!phoneNumber.startsWith("+")) {
      phoneNumber = `+${phoneNumber}`;
    }

    // Parse the phone number
    const parsedNumber = phoneUtil.parse(phoneNumber);

    // Get country code and region code
    const countryCode = parsedNumber.getCountryCode();
    const regionCode = phoneUtil.getRegionCodeForNumber(parsedNumber);

    const countryName = regionCode ? regionDisplay.of(regionCode) : "Unknown Country";

    // Check if the number is valid and possible
    const isValid = phoneUtil.isValidNumber(parsedNumber);
    const isPossible = phoneUtil.isPossibleNumber(parsedNumber);
    const reason = phoneUtil.isPossibleNumberWithReason(parsedNumber);

    if (reason === libphonenumber.PhoneNumberUtil.ValidationResult.TOO_SHORT ||
      reason === libphonenumber.PhoneNumberUtil.ValidationResult.TOO_LONG) {
      return {
        success: false,
        message: `The phone number length is incorrect for ${countryName}.`,
      };
    }

    if (!isPossible) {
      return {
        success: false,
        message: `The phone number length is incorrect for ${countryName}.`,
      };
    }

    if (!isValid) {
      return {
        success: false,
        message: `Invalid phone number for ${countryName}.`,
      };
    }

    return {
      success: true,
      phoneNumber,
      countryCode,
      region: regionCode,
      formatted: phoneUtil.format(parsedNumber, libphonenumber.PhoneNumberFormat.E164),
    };

  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "An unknown error occurred." };
  }
};


export const isValidUSPhoneNumber = (phone: string): boolean => {
  const phoneNumber = parsePhoneNumberFromString(phone, 'US');
  return !!phoneNumber && phoneNumber.isValid() && phoneNumber.country === 'US';
}


// Turns a word or string to a Title case
export const toTitleCase = (str: string) => {
  return str.toLowerCase().split(" ").map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

export const titleCase = (str: string) => {
  if (!str) return null;
  return str.toLowerCase().split(" ").map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

// Generate a 6 digit OTP (One Time Passcode)
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};


// Generate a token with a payload and time-to-live (ttl).
export const generateToken = (payload: object, ttl: string): string => {
  // If ttl is a string, explicitly cast it to ms.StringValue.
  const expiresIn: number | StringValue = typeof ttl === 'string' ? ttl as StringValue : ttl;
  const options: SignOptions = { expiresIn, algorithm: 'HS256' };
  return jwt.sign(payload, SECRET_KEY, options);
}


// Verify a token and always resolve to a result object instead of throwing an error
export const verifyToken = (token: string): Promise<VerifyTokenResult> => {
  return new Promise((resolve) => {
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
      if (err) {
        resolve({ valid: false, error: err });
      } else {
        resolve({ valid: true, decoded: decoded as string | JwtPayload });
      }
    });
  });
}


export const ExtractToken = (req: Request): string => {
  const hasAuthorization = req.headers.authorization;
  if (!hasAuthorization) {
    throw new Error("Authorization header is missing");
  }

  const token = hasAuthorization.split(" ")[1];
  if (!token) {
    throw new Error("Token not found");
  }

  return token;
};



// Generate password (e.g: Abcde12@#)
export const generatePassword = (length: number = 8): string => {
  if (length < 8) {
    throw new Error("Password length must be at least 8 characters.");
  }

  const upperCaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowerCaseChars = "abcdefghijklmnopqrstuvwxyz";
  const numberChars = "0123456789";
  const specialChars = "!@#$%^&*()_+[]{}|;:',.<>?/";

  const allChars = upperCaseChars + lowerCaseChars + numberChars + specialChars;

  // Ensure the password has at least one of each required character type
  let password = "";
  password += upperCaseChars[Math.floor(Math.random() * upperCaseChars.length)];
  password += lowerCaseChars[Math.floor(Math.random() * lowerCaseChars.length)];
  password += numberChars[Math.floor(Math.random() * numberChars.length)];
  password += specialChars[Math.floor(Math.random() * specialChars.length)];

  // Fill the remaining length with random characters from all character types
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password to ensure randomness
  const shuffledPassword = password
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");

  return shuffledPassword;
};

// Generate alphanumeric code (for custom ID)
export const generateAlphanumericCodeU = (num: number = 6): string => {
  let code = "";
  while (code.length < num) {
    code += Math.random().toString(36).substring(2);
  }
  return code.substring(0, num).toUpperCase();
};


// Generate alphanumeric code (for custom ID)
export const generateAlphanumericCode = (num: number = 6): string => {
  let code = "";
  while (code.length < num) {
    code += Math.random().toString(36).substring(2);
  }
  return code.substring(0, num);  // Return code without forcing uppercase
};



// Hash the password
export const hashPassword = async (password: string, salt: number): Promise<string> => {
  const saltRounds = salt | 10;
  return await bcrypt.hash(password, saltRounds);
}

// Compare the plain text password with the hashed password
export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
}


// Function to upload or overwrite an image to cloudinary
export const uploadImageToCloudinary = async (image: string, publicId?: string, folderName?: string) => {
  try {
    if (publicId) {
      // Overwrite existing image using public_id
      return await cloudinary.uploader.upload(image, {
        public_id: publicId,
        overwrite: true,
      });
    } else {
      // Upload new image
      return await cloudinary.uploader.upload(image, {
        folder: folderName ? `${folderName}-Images` : "EventParcel-Images",
      });
    }
  } catch (error: unknown) {
    if (error instanceof Error)
      throw new Error("Error uploading photo to Cloudinary: " + error.message);
  }
};


export const uploadImage = async (filePath: string, publicId?: string, folderName?: string): Promise<{ secure_url: string; public_id: string }> => {
  try {
    const result = await uploadImageToCloudinary(filePath, publicId, folderName);
    await fs.promises.unlink(filePath); // Remove local file after upload
    if (!result) {
      throw new Error("Failed to upload image to Cloudinary");
    }
    return result;
  } catch (error: any) {
    throw new Error(`Error uploading image: ${error.message}`);
  }
};


export const deleteImage = async (publicId: string): Promise<boolean> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    return false;
  }
};


// Use a secure, static secret key (store in env variable)
const SECRET_KEY_ENCODED = crypto.scryptSync(SECRET_KEY, 'salt', 32); // Derive a 32-byte key
const IV = crypto.randomBytes(16); // Generate a secure random IV (16 bytes)


// Function to make Base64 URL-safe
const base64UrlEncode = (input: Buffer) =>
  input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Function to decode Base64 URL-safe
const base64UrlDecode = (input: string) =>
  Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");

// Encrypt Data
export const encryptLinkData = (eventId: string, groupId: string, guestPhoneNumber: string): string => {
  const encodedData = `${eventId}|${groupId}|${guestPhoneNumber}`;
  const cipher = crypto.createCipheriv("aes-256-cbc", SECRET_KEY_ENCODED, IV);
  const encryptedData = Buffer.concat([cipher.update(encodedData, "utf8"), cipher.final()]);

  // Combine IV and encrypted data, then Base64 URL encode
  return base64UrlEncode(Buffer.concat([IV, encryptedData]));
};

// Decrypt Data
export const decryptLinkData = (encryptedBase64: string): { eventId: string; groupId: string; guestPhoneNumber: string } => {
  const encryptedBuffer = base64UrlDecode(encryptedBase64);

  // Extract IV and encrypted data
  const iv = encryptedBuffer.subarray(0, 16);
  const encryptedData = encryptedBuffer.subarray(16);

  const decipher = crypto.createDecipheriv("aes-256-cbc", SECRET_KEY_ENCODED, iv);
  const decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

  const [eventId, groupId, guestPhoneNumber] = decryptedData.toString().split("|");
  return { eventId, groupId, guestPhoneNumber };
};



// Helper to promisify Hyperwallet methods
export const hwAsync = <T>(fn: Function, ...args: any[]): Promise<T> => {
  return new Promise((resolve, reject) => {
    fn(...args, (err: Error | null, body: T) => {
      if (err) return reject(err);
      resolve(body);
    });
  });
};


// Utility function to calculate growth rate
// export const calculateGrowthRate = (current: number, previous: number): number => {
//   if (previous === 0) {
//     return current > 0 ? 100 : 0;
//   }
//   return Math.round(((current - previous) / previous) * 100);
// }

// Utility function to calculate growth rate
export const calculateGrowthRate = (current: number, previous: number): number => {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100; // Avoid division by 0
  }

  const rate = ((current - previous) / previous) * 100;
  const cappedRate = Math.max(Math.min(rate, 100), -100); // Cap between -100% and +100%
  return Math.round(cappedRate);
};


// Utility function to get Date range (Between Weeks)
export const getWeekRanges = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)

  // Start of this week (Monday)
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  thisWeekStart.setHours(0, 0, 0, 0);

  // End of this week (Sunday)
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
  thisWeekEnd.setHours(23, 59, 59, 999);

  // Last week (Monday to Sunday)
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);

  const lastWeekEnd = new Date(thisWeekEnd);
  lastWeekEnd.setDate(thisWeekEnd.getDate() - 7);

  return { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd };
};




export const maintainRefreshTokens = (arr: string[], newToken: string) => {
  if (!Array.isArray(arr)) throw new Error("Input must be an array");

  // Trim the array to the last 2 tokens to make room for the new one
  if (arr.length >= 3) {
    arr.splice(0, arr.length - 2); // keep last 2
  }

  // Push the new token
  arr.push(newToken);

  return arr;
};


// export const parseDateTime = (dateStr?: string, timeStr?: string): Date | undefined => {
//   if (!dateStr || !timeStr) return;

//   const [time, meridian] = timeStr.split(" ");
//   if (!time || !meridian) return;

//   let [hour, minute] = time.split(":").map(Number);

//   if (isNaN(hour) || isNaN(minute)) return;

//   if (meridian === "PM" && hour !== 12) hour += 12;
//   if (meridian === "AM" && hour === 12) hour = 0;

//   return new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${minute}:00`);
// };

// export const parseDateTime = (dateStr?: any, timeStr?: any): Date | undefined => {
//   // Coerce to string and trim
//   const date = String(dateStr || "").trim();
//   const timeInput = String(timeStr || "").trim();

//   if (!date || !timeInput) return;

//   const [time, meridian] = timeInput.split(" ");
//   if (!time || !meridian) return;

//   const [hourStr, minuteStr] = time.split(":");
//   if (!hourStr || !minuteStr) return;

//   let hour = Number(hourStr);
//   let minute = Number(minuteStr);

//   if (isNaN(hour) || isNaN(minute)) return;

//   // Adjust for AM/PM
//   if (meridian.toUpperCase() === "PM" && hour !== 12) hour += 12;
//   if (meridian.toUpperCase() === "AM" && hour === 12) hour = 0;

//   // Build a valid ISO 8601 string (UTC)
//   const isoString = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
//   const parsedDate = new Date(isoString);

//   return isNaN(parsedDate.getTime()) ? undefined : parsedDate;
// };

// export const parseDateTime = (dateStr?: any, timeStr?: any): Date | undefined => {
//   const date = String(dateStr || "").trim();
//   const timeInput = String(timeStr || "").trim();

//   if (!date || !timeInput) return;

//   const [time, meridian] = timeInput.split(" ");
//   if (!time || !meridian) return;

//   const [hourStr, minuteStr] = time.split(":");
//   if (!hourStr || !minuteStr) return;

//   let hour = Number(hourStr);
//   let minute = Number(minuteStr);

//   if (isNaN(hour) || isNaN(minute)) return;

//   // Adjust for AM/PM
//   if (meridian.toUpperCase() === "PM" && hour !== 12) hour += 12;
//   if (meridian.toUpperCase() === "AM" && hour === 12) hour = 0;

//   const [year, month, day] = date.split("-").map(Number);
//   if (!year || !month || !day) return;

//   // Construct in local time (not UTC)
//   const localDate = new Date(year, month - 1, day, hour, minute);

//   return isNaN(localDate.getTime()) ? undefined : localDate;
// };


export const parseDateTime = (dateStr?: any, timeStr?: any): Date | undefined => {
  const date = String(dateStr || "").trim();
  const timeInput = String(timeStr || "").trim();

  if (!date || !timeInput) return;

  const [time, meridian] = timeInput.split(" ");
  if (!time || !meridian) return;

  const [hourStr, minuteStr] = time.split(":");
  if (!hourStr || !minuteStr) return;

  let hour = Number(hourStr);
  let minute = Number(minuteStr);

  if (isNaN(hour) || isNaN(minute)) return;

  // Adjust for AM/PM
  if (meridian.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (meridian.toUpperCase() === "AM" && hour === 12) hour = 0;

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return;

  // ✅ Local time (WAT, system timezone)
  const localDate = new Date(year, month - 1, day, hour, minute);

  return isNaN(localDate.getTime()) ? undefined : localDate;
};



// Convert NGN to USD from cached/DB exchange rate
export const convertNgnToUsd = async (amountInNgn: number) => {
  try {
    const REDIS_RATE_KEY = "exchange-rate:NGN:USD";
    const REDIS_CACHE_TTL_SECONDS = 30 * 60;

    const cachedRate = await redisClient.get(REDIS_RATE_KEY);
    if (cachedRate) {
      const parsedRate = Number(cachedRate);
      if (!Number.isNaN(parsedRate) && parsedRate > 0) {
        return amountInNgn * parsedRate;
      }
    }

    const rateRecord = await ExchangeRateModel.findOne({ from: "NGN", to: "USD" });
    if (!rateRecord?.rate || rateRecord.rate <= 0) {
      throw new Error("Exchange rate unavailable. Please try again shortly.");
    }

    await redisClient.set(REDIS_RATE_KEY, rateRecord.rate.toString(), "EX", REDIS_CACHE_TTL_SECONDS);

    return amountInNgn * rateRecord.rate;
  } catch (error) {
    console.error("Error converting NGN to USD:", error);
    throw new Error("Failed to convert currency.");
  }
};


export const convertUsdToNgn = async (amountInUsd: number) => {
  try {
    const REDIS_RATE_KEY = "exchange-rate:USD:NGN";
    const REDIS_CACHE_TTL_SECONDS = 30 * 60;

    const cachedRate = await redisClient.get(REDIS_RATE_KEY);
    if (cachedRate) {
      const parsedRate = Number(cachedRate);
      if (!Number.isNaN(parsedRate) && parsedRate > 0) {
        return amountInUsd * parsedRate;
      }
    }

    const directRateRecord = await ExchangeRateModel.findOne({ from: "USD", to: "NGN" });
    if (directRateRecord?.rate && directRateRecord.rate > 0) {
      await redisClient.set(REDIS_RATE_KEY, directRateRecord.rate.toString(), "EX", REDIS_CACHE_TTL_SECONDS);
      return amountInUsd * directRateRecord.rate;
    }

    const inverseRateRecord = await ExchangeRateModel.findOne({ from: "NGN", to: "USD" });
    if (!inverseRateRecord?.rate || inverseRateRecord.rate <= 0) {
      throw new Error("Exchange rate unavailable. Please try again shortly.");
    }

    const usdToNgnRate = 1 / inverseRateRecord.rate;
    await redisClient.set(REDIS_RATE_KEY, usdToNgnRate.toString(), "EX", REDIS_CACHE_TTL_SECONDS);

    return amountInUsd * usdToNgnRate;
  } catch (error) {
    console.error("Error converting USD to NGN:", error);
    throw new Error("Failed to convert currency.");
  }
};


export const formatPrice = (amount: number, currency: 'NGN' | 'USD' = 'NGN'): string => {
  const symbols: Record<string, string> = {
    NGN: '₦',
    USD: '$'
  };

  const symbol = symbols[currency] || '';
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  return `${symbol}${formattedAmount}`;
}


export const stripCountryCode = (phone?: string): string => {
  if (!phone || typeof phone !== 'string' || phone.trim() === '') {
    return '';
  }

  const cleanPhone = phone.replace(/\s+/g, '');

  if (cleanPhone.startsWith('+234')) {
    return '0' + cleanPhone.slice(4);
  } else if (cleanPhone.startsWith('234')) {
    return '0' + cleanPhone.slice(3);
  }

  return cleanPhone;
};


// getNextWorkingDelay
export function getNextWorkingDelay(): number {
  const now = new Date();
  let delay = 24 * 60 * 60 * 1000; // default: 1 day in ms

  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 5) delay += 2 * 24 * 60 * 60 * 1000; // Friday -> Monday
  else if (day === 6) delay += 1 * 24 * 60 * 60 * 1000; // Saturday -> Monday
  else if (day === 0) delay += 1 * 24 * 60 * 60 * 1000; // Sunday -> Monday

  return delay;
}



export const hasPlatformHomeDelivery = (order: IOrder, eventPackages: { _id: ObjectId; packageDelivery: string[] }[]) => {
  return (
    order?.deliveryType === "homeDelivery" &&
    (
      order.items?.some((pkg: any) => pkg?.packageDeliveryType === "homeDelivery:platformDelivery") ||
      eventPackages.some((pkg: any) => pkg.packageDelivery?.includes("homeDelivery:platformDelivery"))
    )
  );
}


// Helper function to check if it's a dollar order
const isDollarOrder = (input: IOrder | IOrderItem[]): boolean => {
  const isOrder = (input: IOrder | IOrderItem[]): input is IOrder =>
    !Array.isArray(input);

  if (isOrder(input)) {
    // For IOrder, check totalAmountCurrency
    return input.totalAmountCurrency === "USD";
  } else {
    // For IOrderItem[], check if any item has USD currency
    return input.some(item => item?.packagePriceCurrency === "USD");
  }
};


export const hasPlatformHomeDelivery2 = (
  deliveryType: string,
  input: IOrder | IOrderItem[],
  eventPackages: IPackageDeliveryInfo[]
): boolean => {
  // Check if it's not home delivery or if it's a dollar order
  if ((deliveryType !== "homeDelivery" && deliveryType !== "platformDelivery") || isDollarOrder(input)) {
    return false;
  }

  const isOrder = (input: IOrder | IOrderItem[]): input is IOrder =>
    !Array.isArray(input);

  const items = isOrder(input) ? input.items : input;

  const itemHasPlatformDelivery = items.some(item =>
    item.packageDeliveryType?.includes("homeDelivery:platformDelivery") ||
    item.packageDeliveryType?.includes("platformDelivery")
  );

  const packageHasPlatformDelivery = eventPackages.some(pkg =>
    pkg.packageDelivery?.includes("homeDelivery:platformDelivery") ||
    pkg.packageDelivery?.includes("platformDelivery")
  );

  return itemHasPlatformDelivery || packageHasPlatformDelivery;
};



import { DateTime } from "luxon";

export const timeZoneMap: Record<string, string> = {
  UTC: "UTC",
  GMT: "Etc/GMT",
  WAT: "Africa/Lagos",
  CAT: "Africa/Harare",
  EAT: "Africa/Nairobi",
  PST: "America/Los_Angeles",
  CST: "America/Chicago",
  EST: "America/New_York",
  MST: "America/Denver",
  AKST: "America/Anchorage",
  HST: "Pacific/Honolulu",
  IST: "Asia/Kolkata",
  CET: "Europe/Paris",
  EET: "Europe/Bucharest",
  BST: "Europe/London",
  AST: "America/Halifax",
  NST: "America/St_Johns",
  JST: "Asia/Tokyo",
  KST: "Asia/Seoul",
  AEST: "Australia/Sydney",
  ACST: "Australia/Adelaide",
  AWST: "Australia/Perth"
};

export const formatEventDate = (
  date: string,
  time: string,
  timeZone: string = "WAT"
): string => {
  // Map to IANA timezone
  const zone = timeZoneMap[timeZone] || timeZoneMap["WAT"];

  // Defensive check
  if (!timeZoneMap[timeZone]) {
    console.warn(`[formatEventDate] Unknown timeZone "${timeZone}", defaulting to "WAT"`);
  }

  // Parse using Luxon
  const dt = DateTime.fromFormat(`${date} ${time}`, "yyyy-MM-dd hh:mm a", {
    zone
  });

  // // Format for display
  // return dt.toFormat("cccc d'th', LLLL yyyy 'at' hh:mm a");

  // Format: "29 Sep, 2025 at 11:00 AM WAT"
  return `${dt.toFormat("d LLL, yyyy 'at' hh:mm a")} ${timeZone}`;
};



import DeliveryFee from "../models/deliveryFeeModel";
import { StateModel } from "../models/stateModel";
import { CityModel } from "../models/cityModel";

/**
 * Compute delivery fee using State and City ObjectIds.
 * Falls back using an "others" city in the same state if exact city not found.
 */
export const computeDeliveryFee = async (
  pickupStateId: string,
  pickupCityId: string,
  destinationStateId: string,
  destinationCityId: string,
  totalQuantity: number
): Promise<number> => {
  console.log("computeDeliveryFee IDs", pickupStateId, pickupCityId, destinationStateId, destinationCityId, totalQuantity);

  // 1. Check destinationState is delivery-covered
  const destinationState = await StateModel.findOne({ _id: destinationStateId, status: "active" });
  if (!destinationState) {
    throw new Error(
      `We currently do not deliver to the selected destination state. Please check available delivery locations.`
    );
  }

  // Helper: find "others" city ObjectId within a given state
  const getOthersCityId = async (stateId: string) => {
    const othersCity = await CityModel.findOne({ normalizedName: "others", stateId, status: "active" });
    return othersCity ? othersCity._id : null;
  };

  const pickupOthersId = await getOthersCityId(pickupStateId);
  const destOthersId = await getOthersCityId(destinationStateId);

  // 2. Exact match
  let feeRecord = await DeliveryFee.findOne({
    pickupState: new Types.ObjectId(pickupStateId),
    pickupCity: new Types.ObjectId(pickupCityId),
    destinationState: new Types.ObjectId(destinationStateId),
    destinationCity: new Types.ObjectId(destinationCityId),
    status: "active",
  });
  console.log("Exact match feeRecord", feeRecord);

  // 3. Fallback: destination city → "others"
  if (!feeRecord && destOthersId) {
    feeRecord = await DeliveryFee.findOne({
      pickupState: pickupStateId,
      pickupCity: pickupCityId,
      destinationState: destinationStateId,
      destinationCity: destOthersId,
      status: "active",
    });
  }

  // 4. Fallback: pickup city → "others"
  if (!feeRecord && pickupOthersId) {
    feeRecord = await DeliveryFee.findOne({
      pickupState: pickupStateId,
      pickupCity: pickupOthersId,
      destinationState: destinationStateId,
      destinationCity: destinationCityId,
      status: "active",
    });
  }

  // 5. Fallback: both cities → "others"
  if (!feeRecord && pickupOthersId && destOthersId) {
    feeRecord = await DeliveryFee.findOne({
      pickupState: pickupStateId,
      pickupCity: pickupOthersId,
      destinationState: destinationStateId,
      destinationCity: destOthersId,
      status: "active",
    });
  }

  console.log("feeRecord", feeRecord);

  // 6. No mapping found — treat as self-managed (return 0)
  if (!feeRecord) return 0;

  // 7. Compute total delivery fee
  const { baseFee, multiplier } = feeRecord;
  if (totalQuantity <= 4) {
    return baseFee;
  }
  const extraItems = totalQuantity - 4;
  const extra = extraItems * (baseFee * (multiplier / 100));
  return baseFee + extra;
};
