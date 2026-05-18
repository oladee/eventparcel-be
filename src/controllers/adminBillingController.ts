import { Response } from "express";
import mongoose from "mongoose";
import { AuthenticatedRequest } from "../middleware/authentication";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import {
  ServiceFeeRateModel,
  migrateLegacyPlatformSettingsIntoRatesIfPossible,
  purgeLegacyPlatformSettingsIfAny,
} from "../models/serviceFeeRateModel";
import { SouvenirListingModel } from "../models/souvenirListingModel";
import { CustomBagListingModel } from "../models/customBagListingModel";

const ALLOWED_CURRENCY = ["NGN", "USD", "GBP"] as const;

export const listServiceFeeRates = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const rows = await ServiceFeeRateModel.find().sort({ currency: 1 }).lean();
    return sendResponse(res, 200, "Service fee rates", rows);
  } catch (e: unknown) {
    if (e instanceof Error)
      return ErrorHandler.internalServerError(res, e.message);
  }
};

export const upsertServiceFeeRate = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const currency = (req.params.currency || "").toUpperCase();
    if (!ALLOWED_CURRENCY.includes(currency as (typeof ALLOWED_CURRENCY)[number])) {
      return ErrorHandler.badUserInput(res, "Currency must be NGN, USD, or GBP.");
    }

    const { ratePercent, minimumCap, maximumCap, allowHostToPassServiceFeeToGuest } =
      req.body;

    if (typeof ratePercent !== "number" || ratePercent < 0 || ratePercent > 100) {
      return ErrorHandler.badUserInput(res, "ratePercent must be a number between 0 and 100.");
    }

    const minDefined = minimumCap !== undefined && minimumCap !== null;
    const maxDefined = maximumCap !== undefined && maximumCap !== null;

    if (minDefined && maxDefined && Number(minimumCap) > Number(maximumCap)) {
      return ErrorHandler.badUserInput(
        res,
        "minimumCap cannot be greater than maximumCap."
      );
    }

    const guestFlagUpdate =
      typeof allowHostToPassServiceFeeToGuest === "boolean"
        ? allowHostToPassServiceFeeToGuest
        : undefined;

    await ServiceFeeRateModel.findOneAndUpdate(
      { currency },
      {
        currency,
        ratePercent,
        minimumCap: minDefined ? Number(minimumCap) : null,
        maximumCap: maxDefined ? Number(maximumCap) : null,
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    if (guestFlagUpdate !== undefined) {
      await ServiceFeeRateModel.updateMany(
        {},
        { $set: { allowHostToPassServiceFeeToGuest: guestFlagUpdate } }
      );
      await purgeLegacyPlatformSettingsIfAny();
    } else {
      await migrateLegacyPlatformSettingsIntoRatesIfPossible();
    }

    const out = await ServiceFeeRateModel.findOne({ currency }).lean();

    if (!out) {
      return ErrorHandler.internalServerError(res, "Service fee row missing after save.");
    }

    return sendResponse(res, 200, "Service fee rate saved", out);
  } catch (e: unknown) {
    if (e instanceof Error)
      return ErrorHandler.internalServerError(res, e.message);
  }
};

export const deleteServiceFeeRate = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const currency = (req.params.currency || "").toUpperCase();
    if (!ALLOWED_CURRENCY.includes(currency as (typeof ALLOWED_CURRENCY)[number])) {
      return ErrorHandler.badUserInput(res, "Currency must be NGN, USD, or GBP.");
    }
    await ServiceFeeRateModel.deleteOne({ currency });
    return sendResponse(res, 200, "Service fee rate removed", { currency });
  } catch (e: unknown) {
    if (e instanceof Error)
      return ErrorHandler.internalServerError(res, e.message);
  }
};

/** ---------- Souvenir listings ---------- */

export const listSouvenirListingsAdmin = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const activeOnly = req.query.activeOnly === "true";
    const filter = activeOnly ? { isActive: true } : {};
    const rows = await SouvenirListingModel.find(filter).sort({ tierName: 1 }).lean();
    return sendResponse(res, 200, "Souvenir listings", rows);
  } catch (e: unknown) {
    if (e instanceof Error)
      return ErrorHandler.internalServerError(res, e.message);
  }
};

export const createSouvenirListingAdmin = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { tierName, price, currency, description } = req.body;
    const cur = (currency || "").toUpperCase();
    if (!ALLOWED_CURRENCY.includes(cur as (typeof ALLOWED_CURRENCY)[number])) {
      return ErrorHandler.badUserInput(res, "currency must be NGN, USD, or GBP.");
    }
    if (!tierName || typeof price !== "number") {
      return ErrorHandler.badUserInput(res, "tierName and price are required.");
    }

    const doc = await SouvenirListingModel.create({
      tierName: String(tierName).trim(),
      price,
      currency: cur,
      description: description || "",
      isActive: true,
    });

    return sendResponse(res, 201, "Souvenir listing created", doc);
  } catch (e: unknown) {
    if (e instanceof Error)
      return ErrorHandler.internalServerError(res, e.message);
  }
};

export const updateSouvenirListingAdmin = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ErrorHandler.badUserInput(res, "Invalid listing id.");
    }

    const payload: Record<string, unknown> = {};
    if (req.body.tierName !== undefined) payload.tierName = String(req.body.tierName).trim();
    if (req.body.price !== undefined) payload.price = Number(req.body.price);
    if (req.body.currency !== undefined) {
      const cur = String(req.body.currency).toUpperCase();
      if (!ALLOWED_CURRENCY.includes(cur as (typeof ALLOWED_CURRENCY)[number])) {
        return ErrorHandler.badUserInput(res, "currency must be NGN, USD, or GBP.");
      }
      payload.currency = cur;
    }
    if (req.body.description !== undefined) payload.description = req.body.description;
    if (req.body.isActive !== undefined) payload.isActive = !!req.body.isActive;

    const doc = await SouvenirListingModel.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (!doc) return ErrorHandler.notFound(res, "Souvenir listing not found.");

    return sendResponse(res, 200, "Souvenir listing updated", doc);
  } catch (e: unknown) {
    if (e instanceof Error)
      return ErrorHandler.internalServerError(res, e.message);
  }
};

/** ---------- Custom bag listings ---------- */

export const listCustomBagListingsAdmin = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const activeOnly = req.query.activeOnly === "true";
    const filter = activeOnly ? { isActive: true } : {};
    const rows = await CustomBagListingModel.find(filter).sort({ tierName: 1 }).lean();
    return sendResponse(res, 200, "Custom bag listings", rows);
  } catch (e: unknown) {
    if (e instanceof Error)
      return ErrorHandler.internalServerError(res, e.message);
  }
};

export const createCustomBagListingAdmin = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { tierName, price, currency, description } = req.body;
    const cur = (currency || "").toUpperCase();
    if (!ALLOWED_CURRENCY.includes(cur as (typeof ALLOWED_CURRENCY)[number])) {
      return ErrorHandler.badUserInput(res, "currency must be NGN, USD, or GBP.");
    }
    if (!tierName || typeof price !== "number") {
      return ErrorHandler.badUserInput(res, "tierName and price are required.");
    }

    const doc = await CustomBagListingModel.create({
      tierName: String(tierName).trim(),
      price,
      currency: cur,
      description: description || "",
      isActive: true,
    });

    return sendResponse(res, 201, "Custom bag listing created", doc);
  } catch (e: unknown) {
    if (e instanceof Error)
      return ErrorHandler.internalServerError(res, e.message);
  }
};

export const updateCustomBagListingAdmin = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ErrorHandler.badUserInput(res, "Invalid listing id.");
    }

    const payload: Record<string, unknown> = {};
    if (req.body.tierName !== undefined) payload.tierName = String(req.body.tierName).trim();
    if (req.body.price !== undefined) payload.price = Number(req.body.price);
    if (req.body.currency !== undefined) {
      const cur = String(req.body.currency).toUpperCase();
      if (!ALLOWED_CURRENCY.includes(cur as (typeof ALLOWED_CURRENCY)[number])) {
        return ErrorHandler.badUserInput(res, "currency must be NGN, USD, or GBP.");
      }
      payload.currency = cur;
    }
    if (req.body.description !== undefined) payload.description = req.body.description;
    if (req.body.isActive !== undefined) payload.isActive = !!req.body.isActive;

    const doc = await CustomBagListingModel.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (!doc) return ErrorHandler.notFound(res, "Custom bag listing not found.");

    return sendResponse(res, 200, "Custom bag listing updated", doc);
  } catch (e: unknown) {
    if (e instanceof Error)
      return ErrorHandler.internalServerError(res, e.message);
  }
};

/** ---------- Host-facing catalog reads ---------- */

export const listActiveSouvenirsHost = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const rows = await SouvenirListingModel.find({ isActive: true })
      .sort({ tierName: 1 })
      .lean();
    return sendResponse(res, 200, "Active souvenir listings", rows);
  } catch (e: unknown) {
    if (e instanceof Error)
      return ErrorHandler.internalServerError(res, e.message);
  }
};

export const listActiveCustomBagsHost = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const rows = await CustomBagListingModel.find({ isActive: true })
      .sort({ tierName: 1 })
      .lean();
    return sendResponse(res, 200, "Active custom bag listings", rows);
  } catch (e: unknown) {
    if (e instanceof Error)
      return ErrorHandler.internalServerError(res, e.message);
  }
};
