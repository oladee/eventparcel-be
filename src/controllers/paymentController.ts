import { Request, Response } from "express";
import { OrderService } from "../services/orderServices";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import PaymentService from "../services/paymentServices";
import { Types } from "mongoose";
import { IPayment } from "../interfaces/modelInterface";
import { PaymentSummary, CurrencySummary } from "../interfaces/interface";



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
  
  export const calculatePaymentSummary = (payments: any[]): PaymentSummary => {
    const summaryByCurrency: Record<string, CurrencySummary> = {};
  
    payments.forEach(payment => {
      const order = payment.orderId;
      const currency = order?.totalAmountCurrency || 'NGN';
      const amountCurrency = payment?.currency || currency;
  
      // Initialize currency groups if not exist
      if (!summaryByCurrency[currency]) {
        summaryByCurrency[currency] = { overallSales: 0, netSales: 0 };
      }
  
      // Add overall sales (total guest payment)
      summaryByCurrency[currency].overallSales += order?.totalAmount || 0;
  
      // Add net sales (amount received)
      summaryByCurrency[amountCurrency].netSales += payment?.amount || 0;
    });
  
    return {
      summaryByCurrency,
    };
  };
  

  
// Function to Fetch payment history
export const fetchPaymentHistory = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
      const hostId = req.params.hostId;
// if (!hostId) return ErrorHandler.badUserInput(res, "Host ID is required!");

const { page = 1, limit = 10, search } = req.query;

const pageNumber = Number(page);
const limitNumber = Number(limit);
const skip = (pageNumber - 1) * limitNumber;

const baseQuery = { hostId };

let searchConditions: Record<string, any>[] = [];

if (typeof search === "string" && search.trim().length > 0) {
  const searchTerm = search.trim();
  const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
  const isOrderId = /^ORD_\d+$/i.test(searchTerm);

  searchConditions.push(
    { "order.guestFirstName": searchRegex },
    { "order.guestLastName": searchRegex },
    { "order.guestEmail": searchRegex }
  );

  if (isOrderId) {
    searchConditions.push(
      { "order.orderId": searchTerm },
      { "order._id": Types.ObjectId.isValid(searchTerm) ? new Types.ObjectId(searchTerm) : null }
    );
  } else {
    searchConditions.push({ "order.orderId": searchRegex });
  }

  if (searchTerm.includes(" ")) {
    const [first, last] = searchTerm.split(" ");
    const firstRegex = new RegExp(first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
    const lastRegex = new RegExp(last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");

    searchConditions.push(
      {
        $and: [
          { "order.guestFirstName": firstRegex },
          { "order.guestLastName": lastRegex },
        ],
      },
      {
        $and: [
          { "order.guestFirstName": lastRegex },
          { "order.guestLastName": firstRegex },
        ],
      }
    );
  }
}

const finalQuery = {
  hostId, 
  paymentStatus: "paid",
  ...(searchConditions.length > 0 ? { searchConditions } : {}),
};

// Run DB operations in parallel
const [payments, totalPayments, summaryByCurrency] = await Promise.all([
  PaymentService.getAllPaymentsNew2(finalQuery, skip, limitNumber),
  PaymentService.countPaymentsNew2(finalQuery),
  PaymentService.getPaymentSummaryByHost(hostId),
]);

  
      if (!payments?.length) {
        return sendResponse(res, 200, "No payment record found for the Host", []);
      }
  
      const formattedPayment = payments.map(payment => {
        const order = payment.order as any;

        return {
          orderNumber: order?.orderId,
          guestPayment: order?.totalAmount,
          guestPaymentCurrency: order?.totalAmountCurrency,
          amountReceived: Math.max(0, (order?.totalAmount) - ((order.tax || 0) + (order.homeDeliveryFee || 0))),
          amountReceivedCurrency: payment?.currency,
          items: order.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0),
          homeDeliveryFee: order?.homeDeliveryFee,
          tax: order?.tax,
          totalAmount: payment?.amount,
          totalAmountCurrency: order?.totalAmountCurrency,
          orderId: order,
          paymentStatus: payment?.paymentStatus,
        };
      });
  
      const totalPages = Math.ceil(totalPayments / limitNumber);
  
      if (!summaryByCurrency) {
        return ErrorHandler.notFound(res, "No payment summary found for this host!");
      }
  
      return sendResponse(res, 200, "Payments record fetched successfully!", {
        summary: summaryByCurrency,
        payments: formattedPayment,
        currentPage: pageNumber,
        totalPages,
        totalPayments,
      });
  
    } catch (error: any) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  };
    