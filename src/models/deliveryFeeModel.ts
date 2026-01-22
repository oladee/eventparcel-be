import mongoose, { Schema, Document } from "mongoose";
import { IDeliveryFee } from "../interfaces/modelInterface";

export interface IDeliveryFeeDocument extends IDeliveryFee, Document { }

const DeliveryFeeSchema: Schema = new Schema(
    {
        pickupState: { type: String, required: true },
        pickupCity: { type: String, required: true },
        destinationState: { type: String, required: true },
        destinationCity: { type: String, required: true },
        baseFee: { type: Number, required: true },
        multiplier: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default mongoose.model<IDeliveryFeeDocument>("DeliveryFee", DeliveryFeeSchema);
