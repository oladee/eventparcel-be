import mongoose, { Schema, Document } from "mongoose";
import { IBaseUser, IHost, ICoHost, IAdmin, ISuperAdmin, IUser } from "../interfaces/modelInterface";
import { required } from "@hapi/joi";

// const UserSchema: Schema = new Schema(
//   {
//     firstName: {
//       type: String,
//       lowercase: true,
//     },
//     lastName: {
//       type: String,
//       lowercase: true,
//     },
//     email: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true,
//     },
//     maskedEmail: {
//       type: String,
//     },
//     phoneNumber: {
//       type: String,
//     },
//     role: {
//       type: String,
//       enum: ["host", "cohost"],
//       default: "host",
//     },
//     password: {
//       type: String,
//     },
//     isVerified: {
//       type: Boolean,
//       default: false,
//     },
//     accessToken: {
//       type: String || null,
//       default: null,
//     },
//     refreshToken: [{ 
//       type: String, 
//       required: true 
//     }],
//     imageUrl: {
//       type: String,
//       default: null,
//     },
//     imagePublicId: {
//       type: String,
//       default: null,
//     },
//     lastLogin: [
//       {
//         type: Date,
//         default: [],
//       },
//     ],
//     otp: {
//       type: String,
//     },
//     otpExpiry: {
//       type: Date,
//     },
//     otpAttempts: {
//       type: Number,
//       default: 0,
//     },
//     isOtpVerified: {
//       type: Boolean,
//       default: false,
//     },
//     lastActive: {
//       type: String,
//     },
//     facebookId: {
//       type: String,
//     },
//     googleId: {
//       type: String,
//     },
//     appleId: {
//       type: String,
//     },
//     microsoftId: {
//       type: String,
//     },
//     hostEmail: {
//       type: String,
//     },
//     host: {
//       type: Schema.Types.ObjectId,
//     },
//     coHostInviteStatus: {
//       type: String,
//       enum: ["pending", "accepted", "declined", "canceled"],
//     },
//     balance: {
//       type: Number,
//       default: 0,
//   },
//     usdBalance: {
//       type: Number,
//       default: 0,
//   },
//   isDisabled: {
//     type: Boolean,
//     default: false,
//   },
//   hyperwalletToken: {
//     type: String,
//     required: false,
//   },
//   isHyperwalletVerified: {
//     type: Boolean,
//     default: false,
//   },  
//   },
//   { timestamps: true }
// );

// // Pre-save hook to ensure balance is only for hosts
// UserSchema.pre("save", function (next) {
//   if (this.role !== "host") {
//     this.balance = undefined;
//     this.usdBalance = undefined;
//     this.isDisabled = undefined;
//   }
//   next();
// });

// export const User = mongoose.model<IUser>("User", UserSchema);


// 1. Base User Schema
const BaseUserSchema: Schema = new Schema<IBaseUser>(
  {
    firstName: { type: String, lowercase: true },
    lastName: { type: String, lowercase: true },
    email: { type: String, required: true, lowercase: true },
    maskedEmail: { type: String },
    phoneNumber: { type: String },
    role: {
      type: String,
      // enum: ["host", "cohost", "admin", "superAdmin" ], // 🆕 include admin
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "disabled"],
      default: "inactive",
    },
    hostEmail: { type: String, lowercase: true },
    address: { type: String, lowercase: true },
    city: { type: String, lowercase: true },
    state: { type: String, lowercase: true },
    country: { type: String, lowercase: true },
    password: { type: String },
    isCoHostToo: { type: Boolean, required: false },
    isVerified: { type: Boolean, default: false },
    isDisabled: { type: Boolean, default: false },
    accessToken: { type: String, default: null },
    refreshToken: [{ type: String, required: true }],
    imageUrl: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    lastLogin: { type: Date, default: null },
    lastLoginHistory: [{ type: Date, default: [] }],
    otp: { type: String },
    otpExpiry: { type: Date },
    otpAttempts: { type: Number, default: 0 },
    isOtpVerified: { type: Boolean, default: false },
    lastActive: { type: String },
    facebookId: { type: String },
    googleId: { type: String },
    appleId: { type: String },
    microsoftId: { type: String },
    eventCoHosts: [{
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event"
    },
    isCoHost: {
      type: Boolean,
      default: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  },
  { 
    timestamps: true, 
    discriminatorKey: 'role',  // important
    collection: 'users'        // all documents stay in the same collection
  }
);

// Base User model
export const User = mongoose.model<IBaseUser>("User", BaseUserSchema);

// 2. Host Schema (Discriminator)
const HostSchema = new Schema({
  balance: { type: Number, default: 0 },
  usdBalance: { type: Number, default: 0 },
  isDisabled: { type: Boolean, default: false },
  hyperwalletToken: { type: String },
  isHyperwalletVerified: { type: Boolean, default: false }
});

export const Host = User.discriminator<IHost>('host', HostSchema);

// 3. CoHost Schema (Discriminator)
const CoHostSchema = new Schema({
  host: { 
    type: Schema.Types.ObjectId, 
    ref: "User", 
    required: true // CoHost must belong to a Host
  },
  hostEmail: {
      type: String,
  },
  coHostInviteStatus: {
    type: String,
    enum: ["pending", "accepted", "declined", "canceled"],
    default: "pending"
  }
});

export const CoHost = User.discriminator<ICoHost>('cohost', CoHostSchema);

// 4. Admin Schema (Discriminator)
const AdminSchema = new Schema({
  isAdmin: {
    type: Boolean,
    default: true, // Admins are always admins
  },
  // You can add admin-specific fields here later if needed
});

export const Admin = User.discriminator<IAdmin>('admin', AdminSchema);



// 5. SuperAdmin Schema (Discriminator)
const SuperAdminSchema = new Schema({
  isSuperAdmin: {
    type: Boolean,
    default: true, // Super Admins are always superAdmins 
  },
})

export const SuperAdmin = User.discriminator<ISuperAdmin>('superAdmin', SuperAdminSchema);
