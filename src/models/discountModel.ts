import mongoose, { Schema, model, Document } from "mongoose";
import { IDiscount } from "../interfaces/modelInterface";

const DiscountSchema: Schema = new Schema<IDiscount>(
  {
    event: { 
        type: Schema.Types.ObjectId, 
        ref: "Event", 
        required: true 
    },
    hostId: { 
        type: Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    discountTitle: { 
        type: String, 
        required: true 
    },
    discountValue: { 
        type: Number, 
        required: true 
    },
    discountValueType: {
      type: String,
      enum: ["percentage", "NGN", "USD"],
      required: true,
    },
    discountCode: { 
        type: String, 
        required: true, 
        unique: true 
    },
    discountStatus: { 
        type: String, 
        enum: ["active", "inactive"], 
        default: "active" 
    },
    totalUsed: { 
        type: Number, 
        default: 0 
    },
    overallValue: { 
        type: Number, 
        default: 0 
    },
  },
  { timestamps: true }
);

export const DiscountModel = model<IDiscount>("Discount", DiscountSchema);
