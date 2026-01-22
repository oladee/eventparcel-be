import { Request, Response } from 'express';
import { FeeSummaryService } from '../services/feeSummaryService';
import { AuthenticatedRequest } from "../middleware/authentication";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";


class FeeSummaryController {
// Function to get fee summary
public static async fetchFeeSummary (req: AuthenticatedRequest, res: Response): Promise<Response | undefined>  {
  try {
    const { role } = req.user;
    if (role !== 'superAdmin') {
      return ErrorHandler.forbidden(res, 'You do not have permission to access this resource');
    }

    const summary = await FeeSummaryService.getFeeSummary();
    if (!summary) {
      return ErrorHandler.notFound(res, 'No fee summary found');
    }

    return sendResponse(res, 200, "Admin Fee Summary Successfully Fetched!", summary);

  } catch (error: any) {
    console.error('Error getting fee summary:', error);
    return ErrorHandler.internalServerError(res, error.message || 'An error occurred while fetching the fee summary');
  }
}


};


export default FeeSummaryController;