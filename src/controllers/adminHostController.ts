import { Request, Response } from "express";
import { OrderService } from "../services/orderServices";
import { UserService } from "../services/userServices";
import PaymentService from "../services/paymentServices";
import PaymentAndDeliveryService from "../services/paymentDeliveryServices";
import { EventService } from "../services/eventServices";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { AuthenticatedRequest } from "../middleware/authentication";
import { calculateOrderSummary } from "./orderController";
import { calculateOverallSales } from "./dashboardController";
import mongoose from "mongoose";
import { toTitleCase } from "../helpers/helpers";
import { GuestTracking } from "../models/guestTrackingModel";




class AdminHostController {
// Function to fetch Host summary for Admin 
public static async getAllHostSummary(req: AuthenticatedRequest, res: Response): Promise<Response> {
  try {
    const { page = "1", limit = "10", search, status } = req.query;

    const pageNumber = Math.max(parseInt(page as string, 10), 1);
    const limitNumber = limit === "infinity" ? 0 : Math.max(parseInt(limit as string, 10), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // -----------------------
    // 1.1 Status filter ONLY by "active" | "inactive" | "suspended" | "unverified" | "disabled"
    // -----------------------
    const statusQuery: Record<string, any> = { role: "host" };
  
    if (typeof status === "string") {
      statusQuery.status = status.toLowerCase();
    } else if (Array.isArray(status) && typeof status[0] === "string") {
      statusQuery.status = status[0].toLowerCase();
    }

    // -----------------------
    // 1.2 Search filter ONLY by name or email
    // -----------------------

    const searchQuery: Record<string, any> = { role: "host" };

    if (typeof search === "string" && search.trim()) {
      const searchTerm = search.trim();
      const searchRegex = new RegExp(searchTerm, "i");

      const emailCondition = { email: searchRegex }; // fixed: should be host email

      if (searchTerm.includes(" ")) {
        const [first, last] = searchTerm.split(" ");
        searchQuery.$or = [
          { firstName: new RegExp(first, "i"), lastName: new RegExp(last, "i") },
          { firstName: new RegExp(last, "i"), lastName: new RegExp(first, "i") },
          emailCondition,
        ];
      } else {
        searchQuery.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          emailCondition,
        ];
      }
    }

    // -----------------------
    // 2. Fetch filtered Hosts
    // -----------------------
    const [hosts, totalHosts] = await Promise.all([
      UserService.getUsers((search ? searchQuery : statusQuery), skip, limitNumber || undefined), // allow unlimited if limitNumber is 0
      UserService.countUsers(search ? searchQuery : statusQuery),
    ]);

    // -----------------------
    // 3. Fetch payment summary for each host in parallel
    // -----------------------
    const hostSummaries = await Promise.all(
      hosts.map(async (host) => {
        const overallSales = await PaymentService.getPaymentSummaryByHost(host._id?.toString());

        return {
          _id: host._id,
          hostName: `${host.firstName} ${host.lastName}`,
          email: host.email,
          phoneNumber: host.phoneNumber,
          location: host.address ?? "Not provided",
          overallSales: {
            NGN: overallSales?.summaryByCurrency?.NGN?.overallSales ?? 0,
            USD: overallSales?.summaryByCurrency?.USD?.overallSales ?? 0,
          },
          imageUrl: host.imageUrl,
          role: host.role,
          lastLogin: host.lastLogin,
          status: host.status,
          createdAt: host.createdAt,
        };
      })
    );

    const totalPages = limitNumber > 0 ? Math.ceil(totalHosts / limitNumber) : 1;

    return sendResponse(res, 200, "Hosts fetched successfully!", {
      hosts: hostSummaries,
      currentPage: pageNumber,
      totalPages,
      totalHosts,
    });

  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
}



// Function to fetch an Host Detail & summary for Admin
public static async getAnHostDetails(req: AuthenticatedRequest, res: Response): Promise<Response | undefined> {
  try {
    const { page = "1", limit = "10", orderStatus, search } = req.query;
    const { hostId } = req.params;
    
    // Validate input
    if (!hostId) {
      return ErrorHandler.badUserInput(res, "Host ID is required");
    }

    // Parse pagination parameters
    const pageNumber = Math.max(parseInt(page as string, 10), 1);
    const limitNumber = limit === "infinity" ? 0 : Math.max(parseInt(limit as string, 10), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // Prepare orders query
    const ordersQuery: Record<string, any> = { hostId };
    if (orderStatus) ordersQuery.orderStatus = orderStatus;

    // -----------------------
    // Search filter ONLY by name or email
    // -----------------------
    const searchQuery: Record<string, any> = { ...ordersQuery };

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


    // First get the host to have the email available
    const host = await UserService.getUserById(hostId);
    
    // Validate host exists
    if (!host) {
      return ErrorHandler.notFound(res, "Host not found");
    }

    // Now execute parallel requests for the remaining data
    const [overallSales, events, [orders, orderSum, totalOrders], guestTracking, pickupDetails] = await Promise.all([
      PaymentService.getPaymentSummaryByHost(hostId),
      EventService.getEvents({ hostEmail: host.email }), // Now we can safely use host.email
      Promise.all([
        OrderService.getAllOrders(searchQuery, skip, limitNumber),
        OrderService.getAllOrders({ hostId }), // Get all orders for summary
        OrderService.countOrders({ hostId }), // Count all orders for pagination
      ]),
      GuestTracking.find({ hostId }),
      PaymentAndDeliveryService.getOneByField({ user: new mongoose.Types.ObjectId(hostId) })
    ]);

    // Prepare host details
    const hostDetails = {
      _id: host._id,
      hostName: `${host.firstName} ${host.lastName}`,
      email: host.email,
      phoneNumber: host.phoneNumber,
      location: host.address ?? "Not provided",
      overallSales: {
        NGN: overallSales?.summaryByCurrency?.NGN?.overallSales ?? 0,
        USD: overallSales?.summaryByCurrency?.USD?.overallSales ?? 0,
      },
      imageUrl: host.imageUrl,
      role: host.role,
      lastLogin: host.lastLogin,
      status: host.status,
      createdAt: host.createdAt,
    };

    // Process events in parallel if they exist
    let eventSummaries = [];
    if (Array.isArray(events) && events.length > 0) {
      // Get all event IDs for batch processing
      const eventIds = events.map(event => event._id.toString());
      
      // Fetch summaries for all events at once
      const allSummaries = await OrderService.batchSalesSummaries(eventIds);
      
      // Create a summary map for quick lookup
      const summaryMap = new Map<string, any>();
      allSummaries.forEach(summary => {
        summaryMap.set(summary.eventId, summary.sales);
      });

      // Prepare event data
      eventSummaries = events.map(event => ({
        _id: event._id,
        ...event.toObject(),
        salesSummary: summaryMap.get(event._id.toString()) || [
          { currency: "NGN", totalSales: 0, totalPackagesSold: 0 },
          { currency: "USD", totalSales: 0, totalPackagesSold: 0 }
        ]
      }));
    }

    // Calculate order summaries
    const orderSummary = calculateOrderSummary(orderSum, guestTracking);
    const nairaSales = calculateOverallSales(orderSum, "NGN");
    const dollarSales = calculateOverallSales(orderSum, "USD");

    const { recentOrders, ...filteredSummary } = orderSummary;

    // Prepare pickup details
    const pickupDetailsData = {
      email: host.email,
      phoneNumber: host.phoneNumber,
      location: host.address ?? pickupDetails?.pickupLocation ?? "Not provided",
      imageUrl: host.imageUrl,
      contactName: pickupDetails?.contactName ?? hostDetails.hostName,
      pickUpLocation: pickupDetails?.pickupLocation ?? hostDetails.location,
    };

    // Calculate total pages
    const totalPages = limitNumber > 0 ? Math.ceil(totalOrders / limitNumber) : 1;

    return sendResponse(res, 200, "Host details fetched successfully!", {
      overview: {
        ...filteredSummary,
        nairaSales,
        dollarSales,
      },
      hostDetails,
      events: eventSummaries,
      orders: {
        orders,
        currentPage: pageNumber,
        totalPages,
        totalOrders,
      },
      pickupDetails: pickupDetailsData,
    });

  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
}



// Function to suspend an Host
public static async suspendOrMakeActiveHost(req: AuthenticatedRequest, res: Response): Promise<Response | undefined> {
  try {
    const { hostId } = req.params;
    if (!hostId) {
      return ErrorHandler.badUserInput(res, "Host ID is required");
    }

    const host = await UserService.getUserById(hostId);
    if (!host) {
      return ErrorHandler.notFound(res, "Host not found");
    }

    const { status } = req.body;
    if (status !== "active" && status !== "suspended") 
      return ErrorHandler.badUserInput(res, "Status must be either 'active' or 'suspended'");

    const updatedHost = await UserService.updateUserById(hostId, { status }, true);
    if (!updatedHost) 
      return ErrorHandler.notFound(res, "Failed to suspend host");

    const formattedData = {
      _id: updatedHost._id,
      firstName: toTitleCase(updatedHost.firstName),
      lastName: toTitleCase(updatedHost.lastName),
      email: updatedHost.email,
      maskedEmail: updatedHost.maskedEmail,
      phoneNumber: updatedHost.phoneNumber,
      role: updatedHost.role,
      status: updatedHost.status,
      isVerified: updatedHost.isVerified,
      imageUrl: updatedHost.imageUrl ?? null,
      imagePublicId: updatedHost.imagePublicId ?? null,
      lastLogin: updatedHost.lastLogin ?? null,
      isOtpVerified: updatedHost.isOtpVerified,
      isDisabled: updatedHost.isDisabled,
      createdAt: updatedHost.createdAt,
      updatedAt: updatedHost.updatedAt,
    };

    const message = status === "suspended" ? "Host suspended successfully!" : "Host made active successfully!";

    return sendResponse(res, 200, message, formattedData);

  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
}




// Function to disable/enable a Host
public static async disableOrEnableHost(req: AuthenticatedRequest, res: Response): Promise<Response | undefined> {
  try {
    const { hostId } = req.params;
    if (!hostId) {
      return ErrorHandler.badUserInput(res, "Host ID is required");
    }

    const host = await UserService.getUserById(hostId);
    if (!host) {
      return ErrorHandler.notFound(res, "Host not found");
    }

    const { isDisabled } = req.body;
    if (typeof isDisabled !== "boolean") 
      return ErrorHandler.badUserInput(res, "isDisabled must be a boolean value");

    host.isDisabled = isDisabled; // Update the host's isDisabled status
    await host.save(); // Save the updated host

    // const updatedHost = await UserService.updateUserById(hostId, { isDisabled }, true);
    // if (!updatedHost) 
    //   return ErrorHandler.notFound(res, "Failed to disable host");

    const formattedData = {
      _id: host._id,
      firstName: toTitleCase(host.firstName),
      lastName: toTitleCase(host.lastName),
      email: host.email,
      maskedEmail: host.maskedEmail,
      phoneNumber: host.phoneNumber,
      role: host.role,
      status: host.status,
      isVerified: host.isVerified,
      imageUrl: host.imageUrl ?? null,
      imagePublicId: host.imagePublicId ?? null,
      lastLogin: host.lastLogin ?? null,
      isOtpVerified: host.isOtpVerified,
      isDisabled: host.isDisabled,
      createdAt: host.createdAt,
      updatedAt: host.updatedAt,
    };

    const message = isDisabled ? "Host successfully disabled!" : "Host successfully enabled!";

    return sendResponse(res, 200, message, formattedData);

  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
}



}

  
  export default AdminHostController;
  