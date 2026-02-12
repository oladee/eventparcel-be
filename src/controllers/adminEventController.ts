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

      // --------------------------
      // Parse pagination safely
      // --------------------------
      const pageNumber = Math.max(parseInt(page as string, 10) || 1, 1);
      const limitNumberRaw = limit === "infinity" ? 0 : Math.max(parseInt(limit as string, 10), 1);
      const limitNumber = limitNumberRaw > 0 ? limitNumberRaw : undefined; // undefined = no limit
      const skip = (pageNumber - 1) * (limitNumber || 0);

      // --------------------------
      // Prepare base orders query
      // --------------------------
      const ordersQuery: Record<string, any> = { eventId };
      if (orderStatus) ordersQuery.orderStatus = orderStatus;

      // --------------------------
      // Prepare search query
      // --------------------------
      const searchQuery: Record<string, any> = { ...ordersQuery, paymentStatus: "paid" };

      if (typeof search === "string" && search.trim()) {
        const searchTerm = search.trim();

        let searchRegex: RegExp | null = null;
        try {
          searchRegex = new RegExp(searchTerm, "i");
        } catch (err) {
          console.warn("Invalid search regex, ignoring search:", searchTerm);
          searchRegex = null;
        }

        if (searchRegex) {
          const emailCondition = { guestEmail: searchRegex };
          const orderIdCondition = { orderId: searchTerm };

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

          // Safeguard against empty $or
          if (!searchQuery.$or || searchQuery.$or.length === 0) {
            delete searchQuery.$or;
          }
        }
      }

      // --------------------------
      // Execute all data fetches in parallel
      // --------------------------
      let eventSummary, salesSummary, orders = [], orderSum = [], totalOrders = 0, payoutSummary = [];

      try {
        [eventSummary, salesSummary, [orders, orderSum, totalOrders], payoutSummary] = await Promise.all([
          EventService.getEventSummaryById(eventId),
          OrderService.salesSummaries({ eventId }),
          Promise.all([
            OrderService.getAllOrders(searchQuery, skip, limitNumber),
            OrderService.getAllOrders({ eventId }),
            OrderService.countOrders({ eventId }),
          ]),
          PaymentService.getPaymentSummaryByEventPayout(eventId),
        ]);
      } catch (mongoError) {
        console.error("Mongo query failed:", mongoError);
        return ErrorHandler.internalServerError(res, "Failed to fetch event data");
      }

      if (!eventSummary) {
        return ErrorHandler.notFound(res, "Event not found");
      }

      // --------------------------
      // Calculate order summaries
      // --------------------------
      const orderSummary = calculateOrderSummary(orderSum);

      const { recentOrders, ...filteredSummary } = orderSummary;

      // --------------------------
      // Build sales summary safely
      // --------------------------
      eventSummary.salesSummary = {
        NGN: {
          overallSales: salesSummary[0]?.sales[0]?.totalSales || 0,
          packageSold: salesSummary[0]?.sales[0]?.totalPackagesSold || 0,
          netPayout: payoutSummary.find(p => p.currency === "NGN")?.payout || 0,
        },
        USD: {
          overallSales: salesSummary[0]?.sales[1]?.totalSales || 0,
          packageSold: salesSummary[0]?.sales[1]?.totalPackagesSold || 0,
          netPayout: payoutSummary.find(p => p.currency === "USD")?.payout || 0,
        },
      };

      // --------------------------
      // Safeguard delivery stats
      // --------------------------
      eventSummary.deliveryStat = {
        homeDelivery: eventSummary.deliveryStat?.homeDelivery || 0,
        pickUp: eventSummary.deliveryStat?.pickUp || 0,
      };

      // --------------------------
      // Pagination summary
      // --------------------------
      const totalPages = limitNumber ? Math.ceil(totalOrders / limitNumber) : 1;

      // --------------------------
      // Attach orders info safely
      // --------------------------
      eventSummary.orders = {
        orders,
        currentPage: pageNumber,
        totalPages,
        totalOrders,
      };

      // --------------------------
      // Return full response
      // --------------------------
      return sendResponse(res, 200, "Event summary fetched", eventSummary);
    } catch (error: any) {
      console.error("Unexpected error in getAnEventSummary:", error);
      return ErrorHandler.internalServerError(res, "An unexpected error occurred");
    }
  }

}

export default AdminEventController;
