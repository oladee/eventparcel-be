import mongoose, { Schema, model, Document } from "mongoose";
import { IFeeRecord } from "../interfaces/modelInterface";


const feeRecordSchema: Schema = new mongoose.Schema<IFeeRecord>(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    currency: { 
      type: String, 
      required: true 
    },
    platformFee: { 
      type: Number, 
      required: true 
    },
    deliveryFee: { 
      type: Number, 
      required: true 
    },
    transactionFee: { 
      type: Number, 
      required: true 
    },
    totalAmount: { 
      type: Number, 
      required: true 
    }, // full payment amount
    actualAmount: { 
      type: Number, 
      required: true 
    }, // after deducting delivery + transaction fee
    date: { 
      type: Date, 
      default: Date.now 
    },
  },
  { timestamps: true }
);

export const FeeRecordModel = model<IFeeRecord>("FeeRecord", feeRecordSchema);
