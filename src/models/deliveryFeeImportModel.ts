import mongoose, { Schema } from "mongoose";
import { IDeliveryFeeImport } from "../interfaces/modelInterface";

const DeliveryFeeImportRowSchema = new Schema(
    {
        pickupState: { type: Schema.Types.ObjectId, ref: "State", required: true },
        pickupStateLabel: { type: String, required: true },
        pickupCity: { type: Schema.Types.ObjectId, ref: "City", required: true },
        pickupCityLabel: { type: String, required: true },
        destinationState: { type: Schema.Types.ObjectId, ref: "State", required: true },
        destinationStateLabel: { type: String, required: true },
        destinationCity: { type: Schema.Types.ObjectId, ref: "City", required: true },
        destinationCityLabel: { type: String, required: true },
        baseFee: { type: Number, required: true },
        multiplier: { type: Number, default: 0 },
        rowStatus: {
            type: String,
            enum: ["new", "duplicate", "inactive_match"],
            required: true,
        },
        existingDocId: { type: Schema.Types.ObjectId, ref: "DeliveryFee", default: null },
    },
    { _id: true }
);

const DeliveryFeeImportSchema = new Schema<IDeliveryFeeImport>(
    {
        uploadedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
        rows: { type: [DeliveryFeeImportRowSchema], default: [] },
        // TTL index — MongoDB auto-deletes this doc after expiresAt
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true }
);

// TTL index: MongoDB will remove docs once expiresAt has passed
DeliveryFeeImportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const DeliveryFeeImportModel = mongoose.model<IDeliveryFeeImport>(
    "DeliveryFeeImport",
    DeliveryFeeImportSchema
);
