import { Request, Response } from "express";
import { UserService } from "../services/userServices";
import { EventService, PackageService } from "../services/eventServices";
import { OrderService } from "../services/orderServices";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import PaymentService from "../services/paymentServices";
import { WithdrawalService } from "../services/withdrawalServices";
import { IPayment, IWithdrawal } from "../interfaces/modelInterface";
import { Types } from "mongoose";
import PaymentAndDeliveryService from "../services/paymentDeliveryServices";



export const validateBankAccount = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const { accountNumber, bankCode } = req.body;

        if (!accountNumber || !bankCode) {
            return ErrorHandler.badUserInput(res, "Account number and bank code are required!");
        }

        const result = await PaymentService.validateBankAccount(accountNumber, bankCode);

        if (!result.success) {
            return ErrorHandler.badUserInput(res, result.message || "Invalid account details!");
        }

        return sendResponse(res, 200, "Bank account verified successfully!", result.data);
    } catch (error: unknown) {
        if (error instanceof Error) {
            return ErrorHandler.internalServerError(res, error.message);
        }
    }
};



export const manualWithdrawal = async (req: Request, res: Response) => {
    const { email, amount, currency = "NGN" } = req.body;

    // Basic validation
    if (!email || !amount) {
        return ErrorHandler.badUserInput(res, "Missing required fields");
    }

    // Fetch the user details 
    const host = await UserService.getUserByEmail(email.toLowerCase().trim());
    if (!host) return ErrorHandler.notFound(res, "Host not found!");

    // Find the host's payment details to get the recipientCode
    const paymentDetails = await PaymentAndDeliveryService.getOneByField({ user: host._id as Types.ObjectId });
    

    const hostId = host?._id?.toString();
    const recipientCode = (paymentDetails?.nairaAccount as any)?.recipientCode;

    try {
        const response = await WithdrawalService.initiateWithdrawal(
            hostId,
            email,
            amount,
            currency,
            recipientCode
        );

        // console.log("Response: ", JSON.stringify(response, null, 2))
        return sendResponse(res, 200, `Manual withdrawal request for ₦${amount} to ${email} successful.`, response);

    } catch (error: any) {
        console.error("❌ Withdrawal failed:", error);
        return ErrorHandler.internalServerError(res, "Withdrawal failed:"  + error.message);
    }
};
