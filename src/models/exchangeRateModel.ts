import mongoose, { Schema } from "mongoose";
import { IExchangeRate } from "../interfaces/modelInterface";

const ExchangeRateSchema = new Schema<IExchangeRate>(
  {
    from: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    to: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    source: {
      type: String,
      default: "ExchangeRate-API",
    },
    lastFetchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

ExchangeRateSchema.index({ from: 1, to: 1 }, { unique: true });

export const ExchangeRateModel = mongoose.model<IExchangeRate>("ExchangeRate", ExchangeRateSchema);
