import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "../interfaces/modelInterface";

const AdminSchema: Schema = new Schema(
  {
    firstName: {
      type: String,
      lowercase: true,
    },
    lastName: {
      type: String,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    maskedEmail: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    role: {
      type: String,
      default: "admin",
    },
    password: {
      type: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    accessToken: {
      type: String || null,
      default: null,
    },
    refreshToken: [{ 
      type: String, 
      required: true 
    }],
    imageUrl: {
      type: String,
      default: null,
    },
    imagePublicId: {
      type: String,
      default: null,
    },
    lastLogin: [
      {
        type: Date,
      },
    ],
    otp: {
      type: String,
    },
    otpExpiry: {
      type: Date,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },
    isOtpVerified: {
      type: Boolean,
      default: false,
    },
    lastActive: {
      type: String,
    },
    facebookId: {
      type: String,
    },
    googleId: {
      type: String,
    },
    appleId: {
      type: String,
    },
    microsoftId: {
      type: String,
    },
    balance: {
      type: Number,
      default: 0,
  },
    usdBalance: {
      type: Number,
      default: 0,
  },
  isDisabled: {
    type: Boolean,
    default: false,
  },
  hyperwalletToken: {
    type: String,
    required: false,
  },
  isHyperwalletVerified: {
    type: Boolean,
    default: false,
  },  
  },
  { timestamps: true }
);

export const AdminModel = mongoose.model<IUser>("Admin", AdminSchema);
