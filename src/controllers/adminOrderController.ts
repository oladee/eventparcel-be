import { Request, Response } from "express";
import { OrderService } from "../services/orderServices";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { GuestTracking } from "../models/guestTrackingModel";
import { AuthenticatedRequest } from "../middleware/authentication";
import { calculateOrderSummary, calculateOrderSummaryAdmin } from "./orderController";
import { IOrderSummary } from "../interfaces/interface";

class AdminOrderController {
  // Function to fetch Order summary for Admin
  public static async getOrderSummary(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | undefined> {
    try {
      const { page = "1", limit = "10", hostId, eventId, eventGroupId, orderStatus, search, } = req.query as {
            page?: string;
            limit?: string;
            hostId?: string;
            eventId?: string;
            eventGroupId?: string;
            orderStatus?: string;
            search?: string;
        };
  
      const pageNumber = parseInt(page as string, 10);
      const limitNumber = parseInt(limit as string, 10);
      const skip = (pageNumber - 1) * limitNumber;
  
      // -----------------------
      // 1. Summary filter ONLY by host/event/group
      // -----------------------
      const summaryQuery: Record<string, any> = { paymentStatus: "paid" };
      if (hostId) summaryQuery.hostId = hostId;
      else if (eventId) summaryQuery.eventId = eventId;
      else if (eventGroupId) summaryQuery.eventGroupId = eventGroupId;
  
      const filterType = hostId ? "host" : eventId ? "event" : eventGroupId ? "event group" : "all orders";

      // -----------------------------------
      // 2. Orders filter (all params)
      // -----------------------------------
      const ordersQuery: Record<string, any> = { ...summaryQuery };
      if (orderStatus) {
        ordersQuery.orderStatus = ["delivered", "pickedUp"].includes(orderStatus)
        ? { $in: ["delivered", "pickedUp"] }
        : orderStatus;
      }
  
      // if (orderStatus) ordersQuery.orderStatus = orderStatus;
  
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
  
      // -----------------------
      // 3. Fetch filtered orders
      // -----------------------
      const [orders, orderCal, totalOrders] = await Promise.all([
        OrderService.getAllOrders((search ? searchQuery : ordersQuery), skip, limitNumber),
        OrderService.getAllOrders(summaryQuery),
        OrderService.countOrders(search ? searchQuery : ordersQuery),
      ]);
  
      // -----------------------
      // 4. Fetch full summary by summaryQuery
      // -----------------------
      const contacts = await GuestTracking.find(summaryQuery).sort({ createdAt: -1 });

      console.log("Orders for calculation: ", orderCal.length);
  
      const totalPages = Math.ceil(totalOrders / limitNumber);
      const orderSummary: IOrderSummary = calculateOrderSummaryAdmin(orderCal, contacts);
      const { recentOrders, ...filteredSummary } = orderSummary;
  
      return sendResponse(res, 200, `Orders successfully fetched for ${filterType}!`, {
        orderSummary: filteredSummary,
        orders,
        currentPage: pageNumber,
        totalPages,
        totalOrders,
      });
    } catch (error: any) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
  

  // Function to fetch an Order Detail for Admin
  public static async getAnOrderDetails(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | undefined> {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        return ErrorHandler.badUserInput(res, "Order ID is required");
      }

      const order = await OrderService.getOrderById(orderId);
      if (!order) {
        return ErrorHandler.notFound(res, "Order not found");
      }

      return sendResponse(
        res,
        200,
        "Order detail successfully fetched!",
        order
      );
    } catch (error: any) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
}

export default AdminOrderController;
