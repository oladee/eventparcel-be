import mongoose, { Schema, model, Document } from "mongoose";
import { IActivityLog } from "../interfaces/modelInterface";

const ActivityLogSchema: Schema = new Schema<IActivityLog>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    group: {
      type: Schema.Types.ObjectId,
      ref: "EventGroup",
    },
    action: {
      type: String,
      required: true,
    },
    actionType: {
      type: String,
      required: true,
    },
    entity: {
      type: String,
      required: true,
    },
    entityType: {
      type: String,
    },
    meta: {
      type: Object,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const ActivityLogModel = model<IActivityLog>(
  "ActivityLog",
  ActivityLogSchema
);
