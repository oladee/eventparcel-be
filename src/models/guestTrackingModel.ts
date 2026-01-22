import mongoose, { Schema, model, Document } from "mongoose";
import { IGuestTracking } from "../interfaces/modelInterface";

const GuestTrackingSchema: Schema = new Schema<IGuestTracking>(
  {
    guestName: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    eventGroupId: {
      type: Schema.Types.ObjectId,
      ref: "EventGroup",
      required: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    hostId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    inviteLink: {
      type: String,
      required: true,
    },
    hasViewed: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "viewed", "ordered"],
      default: "pending",
    },
    viewedAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Export the model
export const GuestTracking = model<IGuestTracking>(
  "GuestTracking",
  GuestTrackingSchema
);
