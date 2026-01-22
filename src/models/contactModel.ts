import mongoose, { Schema, model, Document, } from "mongoose";
import { IGuestContact, IContact } from "../interfaces/modelInterface";

const GuestContactSchema = new Schema<IGuestContact>({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  guestName: { 
    type: String, 
    required: true 
},
  guestPhoneNumber: { 
    type: String, 
    required: true 
},
});

const ContactSchema = new Schema<IContact>(
  {
    user: { 
        type: Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    contacts: [{ 
        type: GuestContactSchema, 
        required: true 
    }],
  },
  { timestamps: true }
);


export const GuestContactModel = model<IGuestContact>('GuestContact', GuestContactSchema);
export const ContactModel = model<IContact>('Contact', ContactSchema);