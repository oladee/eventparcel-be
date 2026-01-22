import { Request, Response } from "express";
import { OrderService } from "../services/orderServices";
import PaymentService from "../services/paymentServices";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { AuthenticatedRequest } from "../middleware/authentication";
import { WithdrawalService } from "../services/withdrawalServices";
import { CurrencySummaryType } from "../interfaces/interface";
import { FeeSummaryService } from "../services/feeSummaryService";



class AdminTransactionController {
// Function to fetch Delivery summary for Admin 
public static async getTransactionSummary(req: AuthenticatedRequest, res: Response): Promise<Response> {
  try {
    const { page = "1", limit = "10", hostId, search } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

     // -----------------------
      // 1. Summary filter ONLY by host/event/group
      // -----------------------
      const summaryQuery: Record<string, any> = {};
      if (hostId) summaryQuery.hostId = hostId;
  
          // -----------------------
    // 2. Search filter ONLY by name or email
    // -----------------------
    const searchQuery: Record<string, any> = { ...summaryQuery };

    if (typeof search === "string" && search.trim()) {
      const searchTerm = search.trim();
      const searchRegex = new RegExp(searchTerm, "i");

      const emailCondition = { guestEmail: searchRegex }; // fixed: should be guest email
      const orderIdCondition = { orderId: searchTerm }; // fixed: should be order ID

      if (searchTerm.includes(" ")) {
        const [first, last] = searchTerm.split(" ");
        searchQuery.$or = [
          { guestFirstName: new RegExp(first, "i"), guestLastName: new RegExp(last, "i") },
          { guestFirstName: new RegExp(last, "i"), guestLastName: new RegExp(first, "i") },
          emailCondition,
          orderIdCondition,
        ];
      } else {
        searchQuery.$or = [
          { guestFirstName: searchRegex },
          { guestLastName: searchRegex },
          emailCondition,
          orderIdCondition,
        ];
      }
  }
  
      // Run DB operations in parallel
      const [payments, totalPayments, summaryByCurrency, payoutSummary, payoutSummary2] = await Promise.all([
        PaymentService.getAllPayments(searchQuery, skip, limitNumber),
        PaymentService.countPayments(searchQuery),
        PaymentService.getPaymentSummary(),
        WithdrawalService.calculateHostPayouts(null, "completed"),
        OrderService.salesSummaries(), // Removed eventIds as it is not defined
      ]);
      console.log("Net Payout: ", JSON.stringify(payoutSummary, null, 2));
  
      if (!payments?.length) {
        return sendResponse(res, 200, "No payment record found for the Host", []);
      }
  
      const formattedPayment = payments.map(payment => {
        const order = payment.orderId as any;

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
}


public static async getTransactionSummaryNew(req: AuthenticatedRequest, res: Response): Promise<Response> {
  try {
    const { page = "1", limit = "10", hostId, search } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const baseFilter: Record<string, any> = { paymentStatus: "paid" };
    if (hostId) baseFilter.hostId = hostId;

    let searchConditions: Record<string, any>[] = [];

    if (typeof search === "string" && search.trim().length > 0 && search !== "") {
      const searchTerm = search.trim();
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedTerm, "i");

      const isOrderId = /^ORD_\d+$/i.test(searchTerm);

      searchConditions = [
        { "order.guestFirstName": searchRegex },
        { "order.guestLastName": searchRegex },
        { "order.guestEmail": searchRegex },
      ];

      if (isOrderId) {
        searchConditions.push({ "order.orderId": searchTerm });
        searchConditions.push({ "order._id": searchTerm });
      } else {
        searchConditions.push({ "order.orderId": searchRegex });
      }

      if (searchTerm.includes(" ")) {
        const [first, last] = searchTerm.split(" ");
        const firstRegex = new RegExp(first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
        const lastRegex = new RegExp(last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");

        searchConditions.push({
          $and: [
            { "order.guestFirstName": firstRegex },
            { "order.guestLastName": lastRegex },
          ],
        });
        searchConditions.push({
          $and: [
            { "order.guestFirstName": lastRegex },
            { "order.guestLastName": firstRegex },
          ],
        });
      }
    }

    const [payments, totalPayments, summaryByCurrency, payoutSummary, feeSummary, platformFeeSummary, summaryByCurrencyNew] = await Promise.all([
      PaymentService.getAllPaymentsNew(baseFilter, skip, limitNumber, searchConditions),
      PaymentService.countPaymentsNew(baseFilter, searchConditions),
      PaymentService.getPaymentSummary(),
      WithdrawalService.calculateTotalPayoutsForAdmin("completed"),
      FeeSummaryService.getFeeSummary(),
      FeeSummaryService.getPlatformFeeSummary(),
      FeeSummaryService.getWeeklySalesSummaryByCurrency(),
    ]);
    // console.log("Net Payout: ", JSON.stringify(payoutSummary, null, 2));


    const formattedPayments = payments.map(payment => {
      const order = payment.order;

      return {
        orderNumber: order?.orderId,
        guestPayment: order?.totalAmount,
        guestPaymentCurrency: order?.totalAmountCurrency,
        amountReceived: Math.max(0, (order?.totalAmount || 0) - ((order.tax || 0) + (order.homeDeliveryFee || 0))),
        amountReceivedCurrency: payment.currency,
        items: Array.isArray(order?.items) ? order.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) : 0,
        homeDeliveryFee: order?.homeDeliveryFee,
        serviceFee: parseFloat(payment?.platformFee?.toFixed(2)) || 0,
        transactionFee: parseFloat(payment?.transactionFee?.toFixed(2)) || 0,
        tax: order?.tax,
        totalAmount: payment.amount,
        totalAmountCurrency: order?.totalAmountCurrency,
        orderId: order,
        paymentStatus: payment.paymentStatus,
      };
    });

    const totalPages = Math.ceil(totalPayments / limitNumber);

    // console.log("Fee Summary: ", JSON.stringify(summaryByCurrencyNew, null, 2));

    const newSummaryByCurrency: any = {
      summaryByCurrency: {
          NGN: {
              ...summaryByCurrency.summaryByCurrency.NGN,
              // netPayout: payoutSummary[1]?.currency === "NGN" ? payoutSummary[1]?.totalAmount : "Not NGN",
              netPayout: feeSummary ? feeSummary?.[0]?.totalActualAmount : "Not NGN",
              serviceFee: platformFeeSummary ? platformFeeSummary?.totalPlatformFeeNGN : "Not NGN",
          },
          USD: {
              ...summaryByCurrency.summaryByCurrency.USD,
              // netPayout: payoutSummary[0]?.currency === "USD" ? payoutSummary[0]?.totalAmount : "Not USD",
              netPayout: feeSummary ? feeSummary?.[1]?.totalActualAmount : "Not USD", 
              serviceFee: platformFeeSummary ? platformFeeSummary?.totalPlatformFeeUSD : "Not USD",              
          }
      }
    }

    // const newSummaryByCurrency: any = {
    //   summaryByCurrency: summaryByCurrencyNew
    // }

    if (!payments.length) {
      return sendResponse(res, 200, "No payment record found!", {
        summary: newSummaryByCurrency,
        payments: [],
        currentPage: pageNumber,
        totalPages,
        totalPayments,
      });
    }

    return sendResponse(res, 200, "Payments record fetched successfully!", {
      summary: newSummaryByCurrency,
      payments: formattedPayments,
      currentPage: pageNumber,
      totalPages,
      totalPayments,
    });

  } catch (error: any) {
    console.error("Error in getTransactionSummary:", error);
    return ErrorHandler.internalServerError(res, error.message);
  }
}



}
  
  export default AdminTransactionController;
  