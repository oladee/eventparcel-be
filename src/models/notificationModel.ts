import mongoose, { Schema, model, Document } from "mongoose";
import { INotification } from "../interfaces/modelInterface";


const notificationSchema = new Schema<INotification>({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'userType'  // Dynamic reference based on userType field
    },
    userType: {
        type: String,
        enum: ['User'],  // Possible models
        required: true
    },
    email: {
        type: String,
        lowercase: true,
    },
    subject: {
        type: String,
    },
    message: {
        type: String,
    }, 
    date: {
        type: String,
    },
    time: {
        type: String,
    }
}, { timestamps: true });

export const notificationModel = model<INotification>('Notifications', notificationSchema);