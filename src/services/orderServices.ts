import { Types } from "mongoose";
import { OrderModel } from "../models/orderModel";
import { IOrder } from "../interfaces/modelInterface";
import { IDeliverySummary } from "../interfaces/interface";
import { calculateGrowthRate } from "../helpers/helpers";



export class OrderService {
    // Create a new order
    public static async createOrder(orderData: IOrder): Promise<IOrder> {
        const order = new OrderModel(orderData);
        await order.save();
        return order;
    }

    // Get order by ID
    public static getOrderById(orderId: string): Promise<IOrder | null> {
        return OrderModel.findById(orderId).populate("items.packageId eventId eventGroupId");
    }

    // Get order by Field
    public static getOrderByField(filter: any = {}): Promise<IOrder | null> {
        return OrderModel.findOne(filter).populate("items.packageId eventId eventGroupId");
    }

    // Get all orders
    // public static getAllOrders(filter: any = {}, skip = 0, limit = 10): Promise<IOrder[]> {
    //     return OrderModel.find(filter)
    //     .populate("items.packageId eventId eventGroupId")
    //     .sort({ createdAt: -1 })
    //     .skip(skip)
    //     .limit(limit);
    // }
    public static getAllOrders(filter: any = {}, skip?: number, limit?: number): Promise<IOrder[]> {
      let query = OrderModel.find(filter)
        .populate("items.packageId eventId eventGroupId")
        .sort({ createdAt: -1 });
    
      if (typeof skip === "number" && typeof limit === "number") {
        query = query.skip(skip).limit(limit);
      }
    
      return query.exec();
    }
    

    // Update order payment status
    public static updatePaymentStatus(orderId: string, status: "Pending" | "Paid"): Promise<IOrder | null> {
        return OrderModel.findOneAndUpdate(
            { orderId },
            { paymentStatus: status },
            { new: true }
        );
    }

    // Update order status
    public static updateOrderStatus(orderId: string, status: "Processing" | "Completed" | "Cancelled"): Promise<IOrder | null> {
        return OrderModel.findOneAndUpdate(
            { orderId },
            { orderStatus: status },
            { new: true }
        );
    }

    // Update Order by ID
    public static updateOrderById(id: string, values: Record<string, any>, newOption: boolean = true): Promise<IOrder | null> {
        return OrderModel.findByIdAndUpdate(
            id, 
            values, 
            { new: newOption }
        );
      }


    // Delete an order by its ID
    public static deleteOrderById(orderId: string): Promise<IOrder | null> {
        return OrderModel.findOneAndDelete({ orderId });
    }

    // Count total number of orders based on a filter
    public static async countOrders(filter: any = {}) {
        return OrderModel.countDocuments(filter);
    }


    // // Aggregate orders based on filters
    // public static async aggregateOrders(filter: any = { paymentStatus: "paid" }) {
    //     return OrderModel.aggregate([
    //         { $match: filter },
    //         {
    //             $group: {
    //                 _id: "$orderStatus",
    //                 count: { $sum: 1 }
    //             }
    //         }
    //     ]);
    // }

    // Aggregate orders based on filters
public static async aggregateOrders() {
    return OrderModel.aggregate([
        {
            $match: {
                paymentStatus: "paid",
                orderStatus: { $exists: true, $nin: [null, ""] } // exclude null & empty
            }
        },
        {
            $group: {
                _id: "$orderStatus",
                count: { $sum: 1 }
            }
        }
    ]);
}


public static async salesSummariesGroup(eventGroupId: string) {
  const matchCondition = {
    paymentStatus: "paid",
    eventGroupId: new Types.ObjectId(eventGroupId)
  };

  const pipeline = [
    { $match: matchCondition },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$totalAmountCurrency",
        totalSales: { $sum: "$totalAmount" },
        totalPackagesSold: { $sum: "$items.quantity" },
        totalHomeDeliveryFee: { $sum: "$homeDeliveryFee" },
        totalVATtax: { $sum: "$tax" },
      }
    },
    {
      $project: {
        _id: 0,
        currency: "$_id",
        totalSales: { $round: ["$totalSales", 2] },
        totalPackagesSold: 1,
        totalHomeDeliveryFee: 1,
        totalVATtax: 1,
      }
    }
  ];

  const results = await OrderModel.aggregate(pipeline);

  if (results.length === 0) {
    // Return array with default zero object
    return [
      {
        eventGroupId,
        sales: [
          {
            currency: "NGN", // set default currency here
            totalSales: 0,
            totalPackagesSold: 0,
            totalHomeDeliveryFee: 0,
            totalVATtax: 0
        }
      ],
      }
    ];
  }

  // Return result in expected format, appending eventGroupId
  // return results.map((res) => ({
  //   eventGroupId,
  //   ...res
  // }));
  return [{
    eventGroupId,
    sales: results.map((res) => ({
      currency: res.currency,
      totalSales: res.totalSales,
      totalPackagesSold: res.totalPackagesSold,
      totalHomeDeliveryFee: res.totalHomeDeliveryFee,
      totalVATtax: res.totalVATtax
    }))
  }];
}



// Get Sales Summaries by eventId or eventGroupId for Admin Dashboard
public static async salesSummaries(filter: { eventId?: string; eventGroupId?: string } = {}) {
  const matchCondition: Record<string, any> = { paymentStatus: "paid" };

  if (filter.eventId) {
    matchCondition['eventId'] = new Types.ObjectId(filter.eventId);
  } else if (filter.eventGroupId) {
    matchCondition['eventGroupId'] = new Types.ObjectId(filter.eventGroupId);
  }

  const pipeline = [
    { $match: matchCondition },
    { $unwind: "$items" },
    {
      $group: {
        _id: {
          eventId: "$eventId",
          currency: "$totalAmountCurrency"
        },
        totalSales: { $sum: "$totalAmount" }, // 📦 sum totalAmount per currency
        totalPackagesSold: { $sum: "$items.quantity" },  // 📦 sum quantity of packages
        // totalPackagesSold: { $sum: 1 },  // ✅ count each package item once
        totalHomeDeliveryFee: { $sum: "$homeDeliveryFee" }, // 📦 sum homeDeliveryFee for every order
        totalVATtax: { $sum: "$tax" }, // 📦 sum VAT Tax for every order
      }
    },
    {
      $group: {
        _id: "$_id.eventId", // 📦 group again by eventId only
        sales: {
          $push: {
            currency: "$_id.currency",
            totalSales: { $round: ["$totalSales", 2] }, // 🎯 round to 2 decimal places (optional)
            totalPackagesSold: "$totalPackagesSold",
            totalHomeDeliveryFee: "$totalHomeDeliveryFee",
            totalVATtax: "$totalVATtax",
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        eventId: "$_id",
        sales: 1
      }
    }
  ];

  const results = await OrderModel.aggregate(pipeline);

  // 🛠 Ensure both NGN and USD always exist
  const fixedResults = results.map((event) => {
    const currencies = ["NGN", "USD"];
    const salesMap = new Map<string, any>();

    event.sales.forEach((sale: any) => {
      salesMap.set(sale.currency, sale);
    });

    // Build full sales array
    const fullSales = currencies.map((currency) => {
      if (salesMap.has(currency)) {
        return salesMap.get(currency);
      } else {
        return {
          currency,
          totalSales: 0,
          totalPackagesSold: 0,
          totalHomeDeliveryFee: 0, 
          totalVATtax: 0,
        };
      }
    });

    return {
      eventId: event.eventId,
      sales: fullSales
    };
  });

  return fixedResults;
}



// Get sales summaries for multiple events
public static async batchSalesSummaries(eventIds: string[]) {
  if (!eventIds || eventIds.length === 0) {
    return [];
  }

  // Convert string IDs to ObjectIds
  const objectIds = eventIds.map(id => new Types.ObjectId(id));

  const pipeline = [
    { 
      $match: { 
        eventId: { $in: objectIds } 
      } 
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: {
          eventId: "$eventId",
          currency: "$totalAmountCurrency"
        },
        totalSales: { $sum: "$totalAmount" },
        totalPackagesSold: { $sum: "$items.quantity" },
        totalHomeDeliveryFee: { $sum: "$homeDeliveryFee" }, // 📦 sum homeDeliveryFee for every order
        totalVATtax: { $sum: "$tax" }, // 📦 sum VAT Tax for every order
      }
    },
    {
      $group: {
        _id: "$_id.eventId",
        sales: {
          $push: {
            currency: "$_id.currency",
            totalSales: { $round: ["$totalSales", 2] },
            totalPackagesSold: "$totalPackagesSold",
            totalHomeDeliveryFee: "$totalHomeDeliveryFee",
            totalVATtax: "$totalVATtax",
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        eventId: "$_id",
        sales: 1
      }
    }
  ];

  const results = await OrderModel.aggregate(pipeline);

  // Ensure both NGN and USD always exist for each event
  const currencies = ["NGN", "USD"];
  const fixedResults = eventIds.map(eventId => {
    // Find the result for this event (if exists)
    const eventResult = results.find(r => r.eventId.toString() === eventId);
    
    // Process sales data
    const salesMap = new Map<string, any>();
    if (eventResult) {
      eventResult.sales.forEach((sale: any) => {
        salesMap.set(sale.currency, sale);
      });
    }

    // Build full sales array with default values if missing
    const fullSales = currencies.map(currency => {
      if (salesMap.has(currency)) {
        return salesMap.get(currency);
      }
      return {
        currency,
        totalSales: 0,
        totalPackagesSold: 0,
        totalHomeDeliveryFee: 0, 
        totalVATtax: 0,
      };
    });

    return {
      eventId,
      sales: fullSales
    };
  });

  return fixedResults;
}



// Get summary of sales and package sold
public static async calculateSalesAndPackages(filter: { eventId?: string; eventGroupId?: string } = {}) {
  // Default filter object
  const matchCondition: Record<string, any> = {};

  // Only add conditions for eventId or eventGroupId if they are provided
  if (filter.eventId) {
    matchCondition['eventId.$oid'] = filter.eventId;
  }

  if (filter.eventGroupId) {
    matchCondition['eventGroupId.$oid'] = filter.eventGroupId;
  }

  // Build the aggregation pipeline
  const pipeline = [
    // Step 1: Match by eventId or eventGroupId if provided
    {
      $match: matchCondition
    },
    // Step 2: Unwind the items array to calculate per-item totals
    {
      $unwind: "$items"
    },
    // Step 3: Group to get the totals
    {
      $group: {
        _id: null, // We are calculating totals for all the orders in the collection
        totalSales: { $sum: "$totalAmount" }, // Sum of all totalAmount values
        totalPackagesSold: { $sum: { $multiply: ["$items.quantity", 1] } } // Sum of quantities for all items
      }
    }
  ];

  try {
    // Execute the aggregation pipeline
    const result = await OrderModel.aggregate(pipeline);

    // If result is empty, return totals as 0
    if (result.length === 0) {
      return {
        totalSales: 0,
        totalPackagesSold: 0
      };
    }

    // Return the aggregated result
    return result[0];

  } catch (error) {
    // Handle any potential errors
    console.error("Error calculating sales and packages:", error);
    throw new Error("An error occurred while calculating sales and packages.");
  }
}




    // Returns the number of delivered and shipped orders for this week, and percentage change vs last week.    
      public static async getDeliverySummaryOld(filter: { hostId?: string; eventId?: string; eventGroupId?: string } = {}): Promise<IDeliverySummary> {
        // Default filter object
        const matchCondition: Record<string, any> = {};

      // Only add conditions for eventId or eventGroupId if they are provided
      if (filter.eventId) {
        matchCondition['eventId.$oid'] = filter.eventId;
      }

      if (filter.eventGroupId) {
        matchCondition['eventGroupId.$oid'] = filter.eventGroupId;
      }

      if (filter.hostId) {
        matchCondition['hostId.$oid'] = filter.hostId;
      }

        // --- week boundaries ---
        const now = new Date();
        const startOfThisWeek = new Date(now);
        startOfThisWeek.setHours(0, 0, 0, 0);
        startOfThisWeek.setDate(
          startOfThisWeek.getDate() - ((startOfThisWeek.getDay() + 6) % 7)
        );
        const startOfLastWeek = new Date(startOfThisWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
        const endOfLastWeek = new Date(startOfThisWeek);
        endOfLastWeek.setMilliseconds(-1);
    
        // --- 1) all‑time totals by status ---
        const allTime = await OrderModel.aggregate([
          {
            $match: {
              ...matchCondition,
              orderStatus: { $in: ["shipped", "delivered"] }
            }
          },
          {
            $group: {
              _id: "$orderStatus",
              count: { $sum: 1 }
            }
          }
        ]);
    
        const totalDelivered = allTime.find(x => x._id === "delivered")?.count || 0;
        const totalShipped  = allTime.find(x => x._id === "shipped")?.count  || 0;
    
        // Delivered this week
        const deliveredThisWeek = await OrderModel.countDocuments({
          ...matchCondition,
          orderStatus: "delivered",
          deliveredAt: { $gte: startOfThisWeek }
        });
    
        // Delivered last week
        const deliveredLastWeek = await OrderModel.countDocuments({
          ...matchCondition,
          orderStatus: "delivered",
          deliveredAt: { $gte: startOfLastWeek, $lte: endOfLastWeek }
        });
    
        // Shipped this week
        const shippedThisWeek = await OrderModel.countDocuments({
          ...matchCondition,
          orderStatus: "shipped",
          shippedAt: { $gte: startOfThisWeek }
        });
    
        // Calculate % change on delivered 
        // let rawPct = deliveredLastWeek === 0
        //   ? (deliveredThisWeek > 0 ? 100 : 0)
        //   : ((deliveredThisWeek - deliveredLastWeek) / deliveredLastWeek) * 100;

        //   const pctDeliveredVsLastWeek = Math.max(0, Math.round(rawPct * 10) / 10);
    
        const pctDeliveredVsLastWeek = calculateGrowthRate(deliveredThisWeek, deliveredLastWeek);
    
        return {
          totalDelivered,
          totalShipped,
          pctDeliveredVsLastWeek,
        //   deliveredThisWeek,
          shippedThisWeek
        };
    }



public static async getDeliverySummary(filter: { hostId?: string; eventId?: string; eventGroupId?: string; paymentStatus?: "paid" } = { }): Promise<IDeliverySummary> {
  const matchCondition: Record<string, any> = {};

  if (filter.eventId) matchCondition['eventId'] = new Types.ObjectId(filter.eventId);
  if (filter.eventGroupId) matchCondition['eventGroupId'] = new Types.ObjectId(filter.eventGroupId);
  if (filter.hostId) matchCondition['hostId'] = new Types.ObjectId(filter.hostId);
  if (filter.paymentStatus) matchCondition['paymentStatus'] = filter.paymentStatus;

  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setHours(0, 0, 0, 0);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - ((startOfThisWeek.getDay() + 6) % 7));
  
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  
  const endOfLastWeek = new Date(startOfThisWeek);
  endOfLastWeek.setMilliseconds(-1);

  const summary = await OrderModel.aggregate([
    {
      $facet: {
        allTime: [
          { $match: { ...matchCondition, orderStatus: { $in: ["pending", "shipped", "delivered", "pickedUp"] } } },
          { $group: { _id: "$orderStatus", count: { $sum: 1 } } }
        ],
        thisWeek: [
          { $match: { ...matchCondition, createdAt: { $gte: startOfThisWeek } } },
          { $group: { _id: null, total: { $sum: 1 } } }
        ],
        lastWeek: [
          { $match: { ...matchCondition, createdAt: { $gte: startOfLastWeek, $lte: endOfLastWeek } } },
          { $group: { _id: null, total: { $sum: 1 } } }
        ],
        shippedThisWeek: [
          { $match: { ...matchCondition, orderStatus: "shipped", shippedAt: { $gte: startOfThisWeek } } },
          { $count: "count" }
        ],
        deliveredThisWeek: [
          { $match: { ...matchCondition, orderStatus: "delivered", deliveredAt: { $gte: startOfThisWeek } } },
          { $count: "count" }
        ],
        pickedUpThisWeek: [
          { $match: { ...matchCondition, orderStatus: "pickedUp", pickedUpAt: { $gte: startOfThisWeek } } },
          { $count: "count" }
        ],
        pendingThisWeek: [
          { $match: { ...matchCondition, orderStatus: "pending", createdAt: { $gte: startOfThisWeek } } },
          { $count: "count" }
        ],
        pendingLastWeek: [
          { $match: { ...matchCondition, orderStatus: "pending", createdAt: { $gte: startOfLastWeek, $lte: endOfLastWeek } } },
          { $count: "count" }
        ]
      }
    }
  ]);

  const result = summary[0];

  const totalDelivered = result.allTime.find((x: { _id: string; count: number }) => x._id === "delivered")?.count || 0;
  const totalPickedUp = result.allTime.find((x: { _id: string; count: number }) => x._id === "pickedUp")?.count || 0;
  const totalShipped = result.allTime.find((x: { _id: string; count: number }) => x._id === "shipped")?.count || 0;
  const totalPending = result.allTime.find((x: { _id: string; count: number }) => x._id === "pending")?.count || 0;


  const totalOrders = totalDelivered + totalPickedUp + totalShipped + totalPending;
  const allTotalDelivered = totalDelivered + totalPickedUp;

  const totalOrdersThisWeek = result.thisWeek[0]?.total || 0;
  const totalOrdersLastWeek = result.lastWeek[0]?.total || 0;

  const deliveredThisWeek = result.deliveredThisWeek[0]?.count || 0;
  const pickedUpThisWeek = result.pickedUpThisWeek[0]?.count || 0;
  const shippedThisWeek = result.shippedThisWeek[0]?.count || 0;
  const pendingThisWeek = result.pendingThisWeek[0]?.count || 0;
  const pendingLastWeek = result.pendingLastWeek[0]?.count || 0;

  const pctDeliveredVsLastWeek = calculateGrowthRate(deliveredThisWeek, result.deliveredThisWeek[0]?.count || 0);
  const pctPickedUpVsLastWeek = calculateGrowthRate(pickedUpThisWeek, result.pickedUpThisWeek[0]?.count || 0);
  const pctPendingVsLastWeek = calculateGrowthRate(pendingThisWeek, pendingLastWeek);
  const pctTotalOrdersVsLastWeek = calculateGrowthRate(totalOrdersThisWeek, totalOrdersLastWeek);

  const pctDeliveredVsLastWeek_And_pctPickedUpVsLastWeek = (pctDeliveredVsLastWeek + pctPickedUpVsLastWeek) / 2;

  return {
    totalDelivered: allTotalDelivered,
    totalShipped,
    totalPending,
    totalOrders,
    shippedThisWeek,
    deliveredThisWeek,
    pendingThisWeek,
    pctDeliveredVsLastWeek: pctDeliveredVsLastWeek_And_pctPickedUpVsLastWeek,
    pctPendingVsLastWeek,
    pctTotalOrdersVsLastWeek
  };
}

       
}
