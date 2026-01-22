import { Request, Response } from "express";
import {
  EventService,
  EventGroupService,
  PackageService,
} from "../services/eventServices";
import { OrderService } from "../services/orderServices";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { AuthenticatedRequest } from "../middleware/authentication";
import { calculateOrderSummary } from "./orderController";
import { calculateOverallSales } from "./dashboardController";
import { WithdrawalService } from "../services/withdrawalServices";
import PaymentService from "../services/paymentServices";

class AdminEventController {
  // Function to fetch Event summary for Admin
  public static async getEventSummary(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | undefined> {
    try {
      const { eventId, eventGroupId } = req.query;

      const filter: { eventId?: string; eventGroupId?: string } = {};

      if (typeof eventId === "string") {
        filter.eventId = eventId;
      }
      if (typeof eventGroupId === "string") {
        filter.eventGroupId = eventGroupId;
      }

      const events = await EventService.getEvents();
      if (!events || events.length === 0)
        return sendResponse(res, 200, "No events found", []);

      const summaries = await OrderService.salesSummaries(filter);

      // Build a Map for fast lookup
      const summaryMap = new Map<string, any>();
      summaries.forEach((summary) => {
        summaryMap.set(summary.eventId.toString(), summary.sales);
      });

      const eventData = events.map((event) => {
        const sales = summaryMap.get(event._id.toString()) || [
          { currency: "NGN", totalSales: 0, totalPackagesSold: 0 },
          { currency: "USD", totalSales: 0, totalPackagesSold: 0 },
        ];

        return {
          _id: event._id,
          ...event.toObject(),
          salesSummary: sales,
        };
      });

      return sendResponse(
        res,
        200,
        "List of Events & summary fetched",
        eventData
      );
    } catch (error: any) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }

  // Function to fetch an Event summary for Admin
  public static async getAnEventSummary(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | undefined> {
    try {
      const { page = "1", limit = "10", orderStatus, search } = req.query;
      const { eventId } = req.params;
      if (!eventId) {
        return ErrorHandler.badUserInput(res, "Event ID is required");
      }

      // Parse pagination parameters
      const pageNumber = Math.max(parseInt(page as string, 10), 1);
      const limitNumber =
        limit === "infinity" ? 0 : Math.max(parseInt(limit as string, 10), 1);
      const skip = (pageNumber - 1) * limitNumber;

      // Prepare orders query
      const ordersQuery: Record<string, any> = { eventId };
      if (orderStatus) ordersQuery.orderStatus = orderStatus;

      // -----------------------
      // Search filter ONLY by name or email
      // -----------------------
      const searchQuery: Record<string, any> = { ...ordersQuery, paymentStatus: "paid" };

      if (typeof search === "string" && search.trim()) {
        const searchTerm = search.trim();
        const searchRegex = new RegExp(searchTerm, "i");

        const emailCondition = { guestEmail: searchRegex }; // fixed: should be guest email
        const orderIdCondition = { orderId: searchTerm }; // fixed: should be order ID

        if (searchTerm.includes(" ")) {
          const [first, last] = searchTerm.split(" ");
          searchQuery.$or = [
            {
              guestFirstName: new RegExp(first, "i"),
              guestLastName: new RegExp(last, "i"),
            },
            {
              guestFirstName: new RegExp(last, "i"),
              guestLastName: new RegExp(first, "i"),
            },
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

      // Now execute parallel requests for the remaining data
      const [eventSummary, salesSummary, [orders, orderSum, totalOrders], payoutSummary] = await Promise.all(
        [
          EventService.getEventSummaryById(eventId),
          OrderService.salesSummaries({ eventId }),
          Promise.all([
            OrderService.getAllOrders(searchQuery, skip, limitNumber),
            OrderService.getAllOrders({ eventId }), // Get all orders for summary
            OrderService.countOrders({ eventId }), // Count all orders for pagination
          ]),
          PaymentService.getPaymentSummaryByEventPayout(eventId), // Get payment and delivery details
        ]
      );

      // const eventSummary = await EventService.getEventSummaryById(eventId);
      // const payoutSummary = await WithdrawalService.calculateHostPayouts(eventSummary.user, "completed");
      // console.log("Payout Details: ", JSON.stringify(payoutSummary, null, 2));

      if (!eventSummary) {
        return ErrorHandler.notFound(res, "Event not found");
      }

      // Calculate order summaries
      const orderSummary = calculateOrderSummary(orderSum);
      // const nairaSales = calculateOverallSales(orderSum, "NGN");
      // const dollarSales = calculateOverallSales(orderSum, "USD");

      const { recentOrders, ...filteredSummary } = orderSummary;

      // console.log("Sales Summary: ", JSON.stringify(salesSummary, null, 2));

      // NGN and USD Payout cut 
      // NGN 7% of total sales
      // USD 8.5% of total sales

      eventSummary.salesSummary = {
        NGN: {
          overallSales: salesSummary[0]?.sales[0]?.totalSales || 0,
          packageSold: salesSummary[0]?.sales[0]?.totalPackagesSold || 0, 
          // netPayout: (salesSummary[0]?.sales[0]?.totalSales - (salesSummary[0]?.sales[0]?.totalHomeDeliveryFee + salesSummary[0]?.sales[0]?.totalVATtax)) || 0, 
          netPayout: payoutSummary.find(p => p.currency === "NGN")?.payout || 0, // Safeguard against undefined
          // netPayout2: payoutSummary?.[0]?.currencyBreakdown?.[1]?.currency === "NGN" ? payoutSummary?.[0]?.currencyBreakdown?.[1]?.total : "Not NGN",
        },
        USD: {
          overallSales: salesSummary[0]?.sales[1]?.totalSales || 0,
          packageSold: salesSummary[0]?.sales[1]?.totalPackagesSold || 0,
          // netPayout: (salesSummary[0]?.sales[1]?.totalSales - (salesSummary[0]?.sales[1]?.totalHomeDeliveryFee + salesSummary[0]?.sales[1]?.totalVATtax)) || 0,
         netPayout: payoutSummary.find(p => p.currency === "USD")?.payout || 0, // Safeguard against undefined
          // netPayout2: payoutSummary?.[0]?.currencyBreakdown?.[0]?.currency === "USD" ? payoutSummary?.[0]?.currencyBreakdown?.[0]?.total : "Not USD",
        }
      }

      // Safeguard deliveryStat
      eventSummary.deliveryStat = {
        homeDelivery: eventSummary.deliveryStat?.homeDelivery || 0,
        pickUp: eventSummary.deliveryStat?.pickUp || 0,
      };

      // Calculate total pages
      const totalPages =
        limitNumber > 0 ? Math.ceil(totalOrders / limitNumber) : 1;

      // Safeguard OrderStat
      eventSummary.orders = {
        orders,
        currentPage: pageNumber,
        totalPages,
        totalOrders,
      };

      return sendResponse(res, 200, "Event summary fetched", eventSummary);
    } catch (error: any) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
}

export default AdminEventController;
