import mongoose, { Schema, Document } from "mongoose";
import { IDeliveryFee } from "../interfaces/modelInterface";

export interface IDeliveryFeeDocument extends IDeliveryFee, Document { }

const DeliveryFeeSchema: Schema = new Schema(
    {
        pickupState: { type: Schema.Types.ObjectId, ref: "State", required: true },
        pickupCity: { type: Schema.Types.ObjectId, ref: "City", required: true },
        destinationState: { type: Schema.Types.ObjectId, ref: "State", required: true },
        destinationCity: { type: Schema.Types.ObjectId, ref: "City", required: true },
        baseFee: { type: Number, required: true },
        multiplier: { type: Number, default: 0 },
        status: { type: String, enum: ["active", "inactive"], default: "active" },
    },
    { timestamps: true }
);

// Prevent duplicate active combinations
DeliveryFeeSchema.index(
    { pickupState: 1, pickupCity: 1, destinationState: 1, destinationCity: 1, status: 1 },
    { unique: true }
);

export default mongoose.model<IDeliveryFeeDocument>("DeliveryFee", DeliveryFeeSchema);

