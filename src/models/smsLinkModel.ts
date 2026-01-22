import mongoose, { Schema, Document } from "mongoose";
import { ISMSlink } from "../interfaces/modelInterface";

const SmsLinkSchema: Schema = new Schema<ISMSlink>(
  {
    token: {
      type: String,
      unique: true,
    },
    eventId: { 
        type: Schema.Types.ObjectId,
        ref: "Event",
        required: true 
    },
    groupId: { 
        type: Schema.Types.ObjectId,
        ref: "EventGroup",
        required: true 
    },
    guestPhoneNumber: { 
        type: String, 
        required: true 
    },
  },
  { timestamps: true }
);

export const SmsLinkModel = mongoose.model<ISMSlink>("SmsLink", SmsLinkSchema);
