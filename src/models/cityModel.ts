import { Schema, model, Types } from "mongoose";
import { ICity } from "../interfaces/modelInterface";

const CitySchema: Schema = new Schema<ICity>(
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
    stateId: {
      type: Schema.Types.ObjectId,
      ref: "State",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Compound unique index: same city name cannot appear twice in the same state with the same status
CitySchema.index({ normalizedName: 1, stateId: 1, status: 1 }, { unique: true });

// Auto-derive normalizedName from name before save
CitySchema.pre("save", function (next) {
  this.normalizedName = (this.name as string).toLowerCase().trim();
  next();
});

// Also normalize on findOneAndUpdate / updateOne
CitySchema.pre(["findOneAndUpdate", "updateOne"] as any, function (this: any, next: () => void) {
  const update = this.getUpdate() as any;
  if (update?.name) {
    update.normalizedName = (update.name as string).toLowerCase().trim();
  }
  next();
});

export const CityModel = model<ICity>("City", CitySchema);
