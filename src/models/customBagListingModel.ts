import mongoose, { Schema, model } from "mongoose";

export interface ICustomBagListing extends mongoose.Document {
  tierName: string;
  price: number;
  currency: string;
  description?: string;
  isActive: boolean;
}

const customBagListingSchema = new Schema<ICustomBagListing>(
  {
    tierName: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      enum: ["NGN", "USD", "GBP"],
    },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const CustomBagListingModel = model<ICustomBagListing>(
  "CustomBagListing",
  customBagListingSchema
);
