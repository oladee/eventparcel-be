import mongoose, { Schema, model } from "mongoose";

export interface IServiceFeeRate extends mongoose.Document {
  currency: "NGN" | "USD" | "GBP";
  ratePercent: number;
  minimumCap?: number | null;
  maximumCap?: number | null;
  /** Platform-wide flag, mirrored on every currency row (set via upsert). */
  allowHostToPassServiceFeeToGuest: boolean;
}

const serviceFeeRateSchema = new Schema<IServiceFeeRate>(
  {
    currency: {
      type: String,
      required: true,
      uppercase: true,
      enum: ["NGN", "USD", "GBP"],
      unique: true,
      index: true,
    },
    ratePercent: { type: Number, required: true, min: 0, max: 100 },
    minimumCap: { type: Number, default: null },
    maximumCap: { type: Number, default: null },
    allowHostToPassServiceFeeToGuest: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const ServiceFeeRateModel = model<IServiceFeeRate>(
  "ServiceFeeRate",
  serviceFeeRateSchema
);

async function legacyGuestFeeFlag(): Promise<boolean | undefined> {
  const db = mongoose.connection.db;
  if (!db) return undefined;
  try {
    const doc = await db
      .collection("platformsettings")
      .findOne<{ allowHostToPassServiceFeeToGuest?: unknown }>({});
    if (doc && typeof doc.allowHostToPassServiceFeeToGuest === "boolean")
      return doc.allowHostToPassServiceFeeToGuest;
  } catch {
    //
  }
  return undefined;
}

/**
 * Copies `allowHostToPassServiceFeeToGuest` from legacy PlatformSettings into all rate rows, then clears legacy docs.
 * No-op until at least one `ServiceFeeRate` exists.
 */
export async function migrateLegacyPlatformSettingsIntoRatesIfPossible(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  try {
    const coll = db.collection("platformsettings");
    const legacy = await coll.findOne<{ allowHostToPassServiceFeeToGuest?: unknown }>({});
    if (!legacy) return;

    const flag =
      typeof legacy.allowHostToPassServiceFeeToGuest === "boolean"
        ? legacy.allowHostToPassServiceFeeToGuest
        : true;

    if ((await ServiceFeeRateModel.countDocuments()) === 0) return;

    await ServiceFeeRateModel.updateMany(
      {},
      { $set: { allowHostToPassServiceFeeToGuest: flag } }
    );
    await coll.deleteMany({});
  } catch {
    //
  }
}

/** Drops legacy singleton collection after switching to fee-row storage (safe no-op if empty). */
export async function purgeLegacyPlatformSettingsIfAny(): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    await db.collection("platformsettings").deleteMany({});
  } catch {
    //
  }
}

/** Reads the platform-wide guest-fee flag from service-fee rows (mirrored across currencies); falls back to legacy PlatformSettings if no rows yet. */
export async function getAllowHostToPassServiceFeeToGuest(): Promise<boolean> {
  await migrateLegacyPlatformSettingsIntoRatesIfPossible();

  const row = await ServiceFeeRateModel.findOne()
    .sort({ currency: 1 })
    .lean();

  if (
    row &&
    typeof (row as { allowHostToPassServiceFeeToGuest?: unknown })
      .allowHostToPassServiceFeeToGuest === "boolean"
  ) {
    return (row as { allowHostToPassServiceFeeToGuest: boolean })
      .allowHostToPassServiceFeeToGuest;
  }

  const legacy = await legacyGuestFeeFlag();
  if (typeof legacy === "boolean") return legacy;

  return true;
}
