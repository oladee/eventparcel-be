import { Request, Response } from "express";
import deliveryFeeService from "../services/deliveryFeeService";
import csv from "csvtojson";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";

export const importCSV = async (req: Request, res: Response) => {
  try {
    if (!req.file) return ErrorHandler.badUserInput(res, "CSV file required");

    const jsonArray = await csv().fromFile(req.file.path);
    const data = jsonArray.map((item: any) => ({
      pickupState: item["Pickup State"],
      pickupCity: item["Pickup City"],
      destinationState: item["Destination State"],
      destinationCity: item["Destination City"],
      baseFee: Number(item["Base Fee (?)"]) || 0,
      multiplier: Number(item["Multiplier (%)"]) || 0,
    }));

    const result = await deliveryFeeService.bulkImport(data);
    return sendResponse(res, 201, "CSV imported successfully", {count: result.length});
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
};

export const getAllDeliveryFees = async (req: Request, res: Response) => {
  try {
    const fees = await deliveryFeeService.getAll();
    if (fees.length === 0) return sendResponse(res, 200, "No delivery fees found!", []);

    return sendResponse(res, 200, "Delivery Fees successfully fetched!", fees);
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
};

export const createDeliveryFee = async (req: Request, res: Response) => {
  try {
    const fee = await deliveryFeeService.create(req.body);
    if (!fee) return ErrorHandler.badUserInput(res, "Unable to add delivery fee");

    return sendResponse(res, 200, "Delivery Fee added successfully!", fee);
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
};

export const updateDeliveryFee = async (req: Request, res: Response) => {
  try {
    const fee = await deliveryFeeService.update(req.params.id, req.body);
    if (!fee) return ErrorHandler.badUserInput(res, "Unable to add delivery fee");

    return sendResponse(res, 200, "Delivery Fee updated successfully!", fee);
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
};

export const deleteDeliveryFee = async (req: Request, res: Response) => {
  try {
    const deletefee = await deliveryFeeService.delete(req.params.id);
    if (!deletefee) return ErrorHandler.badUserInput(res, "Unable to delete delivery fee");

    return sendResponse(res, 200, "Deleted successfully");
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
};
