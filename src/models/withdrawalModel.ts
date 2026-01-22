import { Schema, model } from "mongoose";
import { IWithdrawal } from "../interfaces/modelInterface";

const WithdrawalSchema = new Schema<IWithdrawal>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reference: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      enum: ["NGN", "USD"],
      required: true,
      default: "NGN",
      uppercase: true,
    },
    withdrawalStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
      lowercase: true,
    },
    transferId: {
      type: String,
      unique: true,
    },
    email: {
      type: String,
      required: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
  },
  { timestamps: true }
);

export const WithdrawalModel = model<IWithdrawal>("Withdrawal", WithdrawalSchema);
