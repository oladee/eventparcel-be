import mongoose, { Schema, model } from "mongoose";
import { IAdminDeliveryFeeAuditLog } from "../interfaces/modelInterface";

const AdminDeliveryFeeAuditLogSchema = new Schema<IAdminDeliveryFeeAuditLog>(
    {
        action: {
            type: String,
            enum: ["create", "update", "delete"],
            required: true,
        },
        performedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        resource: {
            type: String,
            enum: ["state", "city", "delivery_fee", "delivery_fee_import"],
            required: true,
        },
        resourceId: {
            type: Schema.Types.ObjectId,
            required: true,
        },
        details: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

// Index for efficient admin dashboard queries
AdminDeliveryFeeAuditLogSchema.index({ performedBy: 1, createdAt: -1 });
AdminDeliveryFeeAuditLogSchema.index({ resource: 1, action: 1 });

export const AdminDeliveryFeeAuditLogModel = model<IAdminDeliveryFeeAuditLog>(
    "AdminDeliveryFeeAuditLog",
    AdminDeliveryFeeAuditLogSchema
);

