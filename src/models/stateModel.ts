import { Schema, model } from "mongoose";
import { IState } from "../interfaces/modelInterface";

const StateSchema: Schema = new Schema<IState>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        normalizedName: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
        },
        deliveryCovered : {
            type: Boolean,
            default: false,
        }
    },
    { timestamps: true }
);

// Compound unique index: same normalized name cannot appear twice with the same status
StateSchema.index({ normalizedName: 1, status: 1 }, { unique: true });

// Auto-derive normalizedName from name before save
StateSchema.pre("save", function (next) {
    this.normalizedName = (this.name as string).toLowerCase().trim();
    next();
});

// Also normalize on findOneAndUpdate / updateOne
StateSchema.pre(["findOneAndUpdate", "updateOne"] as any, function (this: any, next: () => void) {
    const update = this.getUpdate() as any;
    if (update?.name) {
        update.normalizedName = (update.name as string).toLowerCase().trim();
    }
    next();
});

export const StateModel = model<IState>("State", StateSchema);
