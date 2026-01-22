import { Request, Response } from "express";
import { OrderService } from "../services/orderServices";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { AuthenticatedRequest } from "../middleware/authentication";

// export const checkAndAddCarrier = (deliveries: any[]) => {
//   const deliveryMap: Record<string, string> = {
//     "homeDelivery:platformDelivery": "GIG",
//     "homeDelivery:selfManaged": "Self Managed",
//     "pickUp": "Picked Up",
//   };

//   return deliveries.map(deliveryRaw => {
//     // Make plain object if caller passed a Mongoose document
//     const delivery =
//       typeof deliveryRaw?.toObject === "function" ? deliveryRaw.toObject() : deliveryRaw;

//     // Prefer order-level selection, fallback to item-level selection
//     const userSelection = delivery.deliveryType || delivery.items?.[0]?.deliveryMethod || null;

//     let carrierName: string | null = null;

//     if (userSelection === "pickUp") {
//       // Buyer explicitly chose pickUp
//       carrierName = deliveryMap["pickUp"];
//     } else if (userSelection === "homeDelivery") {
//       // Buyer chose homeDelivery — find which homeDelivery variant the vendor configured
//       const homeVariant = (delivery.items || []).reduce(
//         (found: string | null, item: any): string | null => {
//           if (found) return found;
//           const pkgDelivery: string[] = item?.packageId?.packageDelivery || [];
//           return pkgDelivery.find((t) => t.startsWith("homeDelivery:")) || null;
//         },
//         null
//       );

//       carrierName = homeVariant ? (deliveryMap[homeVariant] || null) : null;
//     } else {
//       // No explicit user selection recorded — fallback:
//       // prefer any homeDelivery variant if present, otherwise pickUp if present
//       const allPackageDeliveries = (delivery.items || [])
//         .flatMap((it: any) => it?.packageId?.packageDelivery || []);

//       const firstHome = allPackageDeliveries.find((t: string) => t.startsWith("homeDelivery:"));
//       if (firstHome) carrierName = deliveryMap[firstHome] || null;
//       else if (allPackageDeliveries.includes("pickUp")) carrierName = deliveryMap["pickUp"];
//     }

//     return {
//       ...delivery,
//       carrier: carrierName,
//     };
//   });
// };

export const checkAndAddCarrier = (deliveries: any[]) => {
  const deliveryMap: Record<string, string> = {
    "homeDelivery:platformDelivery": "GIG",
    "homeDelivery:selfManaged": "Self Managed",
    "platformDelivery": "Platform Delivery",
    "selfManaged": "Self Managed",
    "pickUp": "Picked Up",
  };

  return deliveries.map(deliveryRaw => {
    const delivery =
      typeof deliveryRaw?.toObject === "function" ? deliveryRaw.toObject() : deliveryRaw;

    const userSelection = delivery.deliveryType || delivery.items?.[0]?.deliveryMethod || null;

    let carrierName: string | null = null;

    if (userSelection === "pickUp") {
      carrierName = deliveryMap["pickUp"];
    } else if (userSelection === "homeDelivery") {
      const homeVariant = (delivery.items || []).reduce(
        (found: string | null, item: any): string | null => {
          if (found) return found;
          const pkgDelivery: string[] = item?.packageId?.packageDelivery || [];
          return pkgDelivery.find((t) => t.startsWith("homeDelivery:")) || null;
        },
        null
      );

      // If no variant is found, default to "Self Managed"
      carrierName = homeVariant
        ? (deliveryMap[homeVariant] || null)
        : "GIG"; // <- fallback here
     } else if (userSelection === "platformDelivery") {
      carrierName = deliveryMap["platformDelivery"];
     } else if (userSelection === "selfManaged") {
      carrierName = deliveryMap["selfManaged"];
     } else {
      const allPackageDeliveries = (delivery.items || [])
        .flatMap((it: any) => it?.packageId?.packageDelivery || []);

      const firstHome = allPackageDeliveries.find((t: string) => t.startsWith("homeDelivery:"));
      if (firstHome) {
        carrierName = deliveryMap[firstHome] || "GIG"; // <- fallback here
      } else if (allPackageDeliveries.includes("pickUp")) {
        carrierName = deliveryMap["pickUp"];
      }
    }

    return {
      ...delivery,
      carrier: carrierName,
    };
  });
};



class AdminDeliveryController {
  // Function to fetch Delivery summary for Admin
  public static async getDeliverySummary(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      const {
        page = "1",
        limit = "10",
        hostId,
        eventId,
        eventGroupId,
        orderStatus,
        search,
      } = req.query as {
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
      // const summaryQuery: Record<string, any> = { orderStatus: "delivered" };
      const summaryQuery: Record<string, any> = {
        paymentStatus: "paid"  /* { $in: ["delivered", "pickedUp"] }, */
      };
      if (hostId) summaryQuery.hostId = hostId;
      else if (eventId) summaryQuery.eventId = eventId;
      else if (eventGroupId) summaryQuery.eventGroupId = eventGroupId;

      const filterType = hostId
        ? "host"
        : eventId
        ? "event"
        : eventGroupId
        ? "event group"
        : "all orders";

      // -----------------------
      // 2. Orders filter (all params)
      // -----------------------
      const ordersQuery: Record<string, any> = { ...summaryQuery };
      // if (orderStatus) {
      //   ordersQuery.orderStatus = ["delivered", "pickedUp"].includes(
      //     orderStatus
      //   )
      //     ? { $in: ["delivered", "pickedUp"] }
      //     : orderStatus;
      // }

      if (orderStatus !== null && orderStatus !== undefined && orderStatus !== "") {
        ordersQuery.orderStatus = ["delivered", "pickedUp"].includes(orderStatus)
          ? { $in: ["delivered", "pickedUp"] }
          : orderStatus;
      } else {
        // fetch all orders with paymentStatus: "paid"
        ordersQuery.paymentStatus = "paid";
      }

      // if (orderStatus) ordersQuery.orderStatus = orderStatus;

      const searchQuery: Record<string, any> = { ...summaryQuery };

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

      // -----------------------
      // 3. Fetch filtered orders
      // -----------------------
      const [deliveries, summary, totalDeliveries] = await Promise.all([
        OrderService.getAllOrders(
          search ? searchQuery : ordersQuery,
          skip,
          limitNumber
        ),
        OrderService.getDeliverySummary({
          ...summaryQuery,
          paymentStatus: "paid",
        }),
        OrderService.countOrders(search ? searchQuery : ordersQuery),
      ]);

      const totalPages = Math.ceil(totalDeliveries / limitNumber);

      const plainDeliveries = deliveries.map((d: any) =>
        typeof d.toObject === "function" ? d.toObject() : d
      );

      const deliveriesWithCarrier = checkAndAddCarrier(plainDeliveries);

      // console.log("The Orders Delivered: ", JSON.stringify(deliveriesWithCarrier, null, 2));

      return sendResponse(res, 200, "Delivery summary fetched!", {
        summary,
        deliveries: deliveriesWithCarrier,
        currentPage: pageNumber,
        totalPages,
        totalDeliveries,
      });
    } catch (error: any) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
}

export default AdminDeliveryController;
