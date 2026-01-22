import mongoose, { Schema, Document } from "mongoose";

const coHostInviteSchema: Schema = new Schema({
    coHost: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    status: {
        type: String,
        enum: ["pending", "accepted", "declined", "expired"],
        default: "pending",
    },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

export const CoHostInvite = mongoose.model("CoHostInvite", coHostInviteSchema);
