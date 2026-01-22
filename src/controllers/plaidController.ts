import { Request, Response } from "express";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { AuthenticatedRequest } from "../middleware/authentication";
import PlaidIntegrationService from '../services/plaidIntegrationService'; // Import the PlaidService class

class PlaidIntegrationController {
  private plaidService: PlaidIntegrationService;

  constructor() {
    this.plaidService = new PlaidIntegrationService();
  }

  // Function to fetch the public token
  async fetchPublicToken(req: AuthenticatedRequest, res: Response) {
    try {
      const { user_id } = req.body; // Assuming the user ID is passed in the request body

      if (!user_id) {
        return ErrorHandler.validationError(res, "User ID is required");
      }

      const response = await this.plaidService.createLinkToken(user_id);

      if (!response || !response.link_token) {
        return ErrorHandler.internalServerError(res, "Failed to generate public token");
      }

      return sendResponse(res, 200, "Public token generated successfully", { public_token: response.link_token });
    } catch (error: any) {
      console.error('Error generating public token:', error);
      return ErrorHandler.internalServerError(res, error.message);
    }
  }

  // Function to fetch bank account details
  async getBankAccountDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { public_token } = req.query;

      if (!public_token) {
        return ErrorHandler.validationError(res, 'Public token is required');
      }

      // Exchange the public token for an access token
      const response = await this.plaidService.exchangePublicToken(String(public_token));
      if (!response || !response.access_token) {
        return ErrorHandler.internalServerError(res, 'Failed to exchange public token');
      }

      const { access_token } = response;

      if (!access_token) {
        return ErrorHandler.validationError(res, 'Access token is required');
      }

      // Fetch the bank account details using the access token
      const bankAccountDetails = await this.plaidService.getBankDetails(access_token);

      return sendResponse(res, 200, "Bank account details fetched successfully", bankAccountDetails);
    } catch (error: any) {
      console.error('Error fetching bank account details:', error);
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
}

export default new PlaidIntegrationController();
