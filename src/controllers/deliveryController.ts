import { Request, Response } from "express";
import { OrderService } from "../services/orderServices";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";


// Function to get the delivery summary for a specific host
export const getDeliverySummary = async (req: Request, res: Response) => {
  try {
    const hostId = req.params.hostId;
    if (!hostId) return ErrorHandler.badUserInput(res, "Host ID is required");

    const summary = await OrderService.getDeliverySummary({hostId});
    if (!summary)
      return ErrorHandler.notFound(res, "No delivery summary found for this host");

    const filteredSummary = {
      totalDelivered: summary.totalDelivered,
      totalShipped: summary.totalShipped,
      pctDeliveredVsLastWeek: summary.pctDeliveredVsLastWeek,
      shippedThisWeek: summary.shippedThisWeek
    }

    return sendResponse(res, 200, "Delivery summary fetched", filteredSummary);

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};
