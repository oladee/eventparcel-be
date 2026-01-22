import { Schema, model } from "mongoose";
import { IPayment } from "../interfaces/modelInterface";

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    hostId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    guestEmail: {
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
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "dispute", "refund"],
      default: "pending",
      lowercase: true,
    },
    paymentReference: {
      type: String,
      unique: true,
      required: true,
    },
    transactionFee: {
      type: Number,
    },
    platformFee: {
      type: Number,
    },
    hostShare: {
      type: Number,
    },
    type: {
        type: String,
        enum: ["payment", "withdrawal"],
        required: true,
        lowercase: true,
        default: "payment",
    },
  },
  { timestamps: true }
);

export const PaymentModel = model<IPayment>("Payment", PaymentSchema);
