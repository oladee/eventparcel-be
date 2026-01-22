import mongoose, { Schema, model, Document } from "mongoose";
import { IGIGAuthCache } from "../interfaces/modelInterface";

const GIGAuthCacheSchema: Schema = new Schema<IGIGAuthCache>(
  {
    serviceName: {
      type: String,
      required: true,
      default: "GIG",
    },
    authToken: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Create TTL index for automatic expiration
GIGAuthCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// create serviceName index for faster queries
GIGAuthCacheSchema.index({ serviceName: 1 });

export const GIGAuthCache = model<IGIGAuthCache>(
  "GIGAuthCache",
  GIGAuthCacheSchema
);
