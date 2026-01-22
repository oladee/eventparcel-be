import { Request, Response } from "express";
import { EventService, EventGroupService, PackageService } from "../services/eventServices";
import { OrderService } from "../services/orderServices";
import { UserService } from "../services/userServices";
import { FeeSummaryService } from "../services/feeSummaryService";
import { AuthenticatedRequest } from "../middleware/authentication";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { IOrder, IOrderItem } from "../interfaces/modelInterface";
import { calculateGrowthRate, getWeekRanges } from "../helpers/helpers";
import { IWeekSummary, IDeliveredSummary, IPendingSummary, IOrderSummary, ISalesSummary, IOrderStatus, AdminDashboardData } from "../interfaces/interface";
import { calculateOrderSummary } from "./orderController";

// export const dashboardDummyData = async (
//   req: Request,
//   res: Response
// ): Promise<Response | undefined> => {
//   try {

//     const data = {
//         overallSales: {
//           totalAmount: 131490000,
//           growthRate: -23.5,
//           monthlySales: [
//             { month: "Jan", sales: 200000 },
//             { month: "Feb", sales: 250000 },
//             { month: "Mar", sales: 300000 },
//             { month: "Apr", sales: 852657 },
//             { month: "May", sales: 280000 },
//             { month: "Jun", sales: 320000 },
//             { month: "Jul", sales: 400000 },
//           ],
//           dailySales: [
//             { day: "Monday", sales: 15000 },
//             { day: "Tuesday", sales: 18000 },
//             { day: "Wednesday", sales: 22000 },
//             { day: "Thursday", sales: 19500 },
//             { day: "Friday", sales: 27000 },
//             { day: "Saturday", sales: 31000 },
//             { day: "Sunday", sales: 25000 },
//           ],
//         },
//         ordersSummary: {
//           totalOrders: {
//             overall: 1256,
//             byWeek: [
//               { week: "Week 1", orders: 320 },
//               { week: "Week 2", orders: 280 },
//               { week: "Week 3", orders: 340 },
//               { week: "Week 4", orders: 316 },
//             ],
//             growthRate: 1.0,
//           },
//           totalDelivered: {
//             overall: 186,
//             byWeek: [
//               { week: "Week 1", delivered: 50 },
//               { week: "Week 2", delivered: 40 },
//               { week: "Week 3", delivered: 55 },
//               { week: "Week 4", delivered: 41 },
//             ],
//             growthRate: 3.9,
//           },
//           pendingOrders: {
//             overall: 58,
//             byWeek: [
//               { week: "Week 1", pending: 15 },
//               { week: "Week 2", pending: 10 },
//               { week: "Week 3", pending: 20 },
//               { week: "Week 4", pending: 13 },
//             ],
//             growthRate: -4.0,
//           },
//         },
//         invitesSummary: {
//           totalInvites: 324,
//           totalViewed: 210,
//           viewedRate: 64.8,
//         },
//         recentOrders: [
//           {
//             id: "order_001",
//             date: "2025-04-24",
//             status: "Pending",
//             product: "6 Yards of Aso Oke and Gele for Women",
//             price: 560000,
//             quantity: 1,
//             image: "https://example.com/image1.jpg",
//           },
//         ],
//       }

//     return sendResponse(res, 200, "Dashboard data fetched successfully", data)

//   } catch (error) {
//     return ErrorHandler.internalServerError(res, (error as Error).message);
//   }
// };

export const dashboardDummyData = async (
  req: Request,
  res: Response
): Promise<Response | undefined> => {
  try {
    const data = {
      overallSales: {
        naira: {
          totalAmount: 131490000, // Naira sales amount
          growthRate: -23.5,
          monthlySales: [
            { month: "Jan", sales: 200000 },
            { month: "Feb", sales: 250000 },
            { month: "Mar", sales: 300000 },
            { month: "Apr", sales: 852657 },
            { month: "May", sales: 280000 },
            { month: "Jun", sales: 320000 },
            { month: "Jul", sales: 400000 },
          ],
          dailySales: [
            { day: "Monday", sales: 15000 },
            { day: "Tuesday", sales: 18000 },
            { day: "Wednesday", sales: 22000 },
            { day: "Thursday", sales: 19500 },
            { day: "Friday", sales: 27000 },
            { day: "Saturday", sales: 31000 },
            { day: "Sunday", sales: 25000 },
          ],
        },
        dollar: {
          totalAmount: 450000, // Dollar sales amount
          growthRate: -15.0,
          monthlySales: [
            { month: "Jan", sales: 1000 },
            { month: "Feb", sales: 1200 },
            { month: "Mar", sales: 1500 },
            { month: "Apr", sales: 3200 },
            { month: "May", sales: 1100 },
            { month: "Jun", sales: 1300 },
            { month: "Jul", sales: 1500 },
          ],
          dailySales: [
            { day: "Monday", sales: 150 },
            { day: "Tuesday", sales: 180 },
            { day: "Wednesday", sales: 220 },
            { day: "Thursday", sales: 195 },
            { day: "Friday", sales: 270 },
            { day: "Saturday", sales: 310 },
            { day: "Sunday", sales: 250 },
          ],
        },
      },
      ordersSummary: {
        totalOrders: {
          overall: 1256,
          byWeek: [
            { week: "Week 1", orders: 320 },
            { week: "Week 2", orders: 280 },
            { week: "Week 3", orders: 340 },
            { week: "Week 4", orders: 316 },
          ],
          growthRate: 1.0,
        },
        totalDelivered: {
          overall: 186,
          byWeek: [
            { week: "Week 1", delivered: 50 },
            { week: "Week 2", delivered: 40 },
            { week: "Week 3", delivered: 55 },
            { week: "Week 4", delivered: 41 },
          ],
          growthRate: 3.9,
        },
        pendingOrders: {
          overall: 58,
          byWeek: [
            { week: "Week 1", pending: 15 },
            { week: "Week 2", pending: 10 },
            { week: "Week 3", pending: 20 },
            { week: "Week 4", pending: 13 },
          ],
          growthRate: -4.0,
        },
      },
      invitesSummary: {
        totalInvites: 324,
        totalViewed: 210,
        viewedRate: 64.8,
      },
      recentOrders: [
        {
          id: "order_001",
          date: "2025-04-24",
          status: "Pending",
          product: "6 Yards of Aso Oke and Gele for Women",
          price: 560000,
          quantity: 1,
          image: "https://example.com/image1.jpg",
        },
      ],
    };

    return sendResponse(res, 200, "Dashboard data fetched successfully", data);
  } catch (error) {
    return ErrorHandler.internalServerError(res, (error as Error).message);
  }
};



// // Function to calculate overall sales summary
// export const calculateOverallSales = (orders: IOrder[], currency: 'NGN' | 'USD'): ISalesSummary => {
//   let totalSales = 0;

//   // Initialize monthly sales record with all months
//   const monthlySales: Record<string, number> = {
//     Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0,
//     Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0,
//   };

//   // Initialize daily sales record with all weekdays
//   const dailySales: Record<string, number> = {
//     Monday: 0, Tuesday: 0, Wednesday: 0,
//     Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0,
//   };

//   // Filter orders based on the selected currency (naira or dollar)
//   const filteredOrders = orders.filter(order => order.totalAmountCurrency === currency);

//   // Loop through each filtered order to calculate total, monthly, and daily sales
//   filteredOrders.forEach(order => {
//     const orderDate = new Date(order.createdAt ?? Date.now()); // Parse order date
//     totalSales += order.totalAmount; // Add to total sales

//     // Get short month name (e.g., Jan, Feb)
//     const month = orderDate.toLocaleString("en-US", { month: "short" }) as keyof typeof monthlySales;
//     if (monthlySales[month] !== undefined) {
//       monthlySales[month] += order.totalAmount;
//     }

//     // Get full weekday name (e.g., Monday, Tuesday)
//     const day = orderDate.toLocaleString("en-US", { weekday: "long" }) as keyof typeof dailySales;
//     if (dailySales[day] !== undefined) {
//       dailySales[day] += order.totalAmount;
//     }
//   });

//   // Convert monthly and daily sales objects to arrays for easier consumption (e.g., charts)
//   const monthlySalesArray = Object.entries(monthlySales).map(([month, sales]) => ({ month, sales }));
//   const dailySalesArray = Object.entries(dailySales).map(([day, sales]) => ({ day, sales }));

//   // Calculate growth rate between last two months with non-zero sales
//   const calculateGrowthRateMonthly = (salesArray: { month: string; sales: number }[]): number => {
//     const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

//     // Sort sales according to calendar month order
//     const sortedSales = [...salesArray].sort((a, b) =>
//       monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
//     );

//     // Guard clause for insufficient data
//     if (sortedSales.length < 2) return 0;

//     // Filter out months with zero sales to avoid invalid growth calculation
//     const nonZeroSales = sortedSales.filter(m => m.sales > 0);
//     if (nonZeroSales.length < 2) return 0;

//     const lastMonth = nonZeroSales[nonZeroSales.length - 1].sales;
//     const prevMonth = nonZeroSales[nonZeroSales.length - 2].sales;

//     if (prevMonth === 0) return 0; // Avoid division by zero

//     // Calculate percentage growth rate
//     return parseFloat((((lastMonth - prevMonth) / prevMonth) * 100).toFixed(2));
//   };

//     // Calculate growth rate between last two days with non-zero sales
//   const calculateGrowthRateDaily = (orders: IOrder[]): number => {
//   if (!orders || orders.length < 2) return 0;

//   // Group by date (YYYY-MM-DD)
//   const salesMap = new Map<string, number>();

//   for (const order of orders) {
//     const dateKey = new Date(order.createdAt ?? Date.now()).toISOString().split('T')[0]; // e.g. "2025-05-28"
//     const currentSales = salesMap.get(dateKey) || 0;
//     salesMap.set(dateKey, currentSales + order.totalAmount);
//   }

//   // Convert map to sorted array by date
//   const sortedSales = Array.from(salesMap.entries())
//     .map(([date, sales]) => ({ date, sales }))
//     .filter(item => item.sales > 0) // Filter out 0 sales
//     .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

//   if (sortedSales.length < 2) return 0;

//   const prevDaySales = sortedSales[sortedSales.length - 2].sales;
//   const lastDaySales = sortedSales[sortedSales.length - 1].sales;

//   if (prevDaySales === 0) return 0;

//   const growthRate = ((lastDaySales - prevDaySales) / prevDaySales) * 100;
//   return parseFloat(growthRate.toFixed(2));
// };

//   return {
//       totalAmount: totalSales,
//       growthRate: calculateGrowthRateMonthly(monthlySalesArray),
//       growthRateDaily: calculateGrowthRateDaily(filteredOrders),
//       monthlySales: monthlySalesArray,
//       dailySales: dailySalesArray,
//   };
// };

// Function to calculate overall sales summary
export const calculateOverallSales = (
  orders: IOrder[],
  currency: 'NGN' | 'USD'
): ISalesSummary => {
  let totalSales = 0;

  const monthlySales: Record<string, number> = {
    Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0,
    Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0,
  };

  const dailySalesByWeekday: Record<string, number> = {
    Monday: 0, Tuesday: 0, Wednesday: 0,
    Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0,
  };

  // Filter orders by selected currency
  const filteredOrders = orders.filter(order => order.totalAmountCurrency === currency);

  // Grouping orders
  const dailySalesByDate = new Map<string, number>(); // e.g. "2025-05-28" => amount

  for (const order of filteredOrders) {
    const orderDate = new Date(order?.createdAt ?? Date.now());

    // Total sales
    totalSales += order.totalAmount;

    // Monthly sales
    const month = orderDate.toLocaleString("en-US", { month: "short" }) as keyof typeof monthlySales;
    if (monthlySales[month] !== undefined) {
      monthlySales[month] += order.totalAmount;
    }

    // Daily sales (weekday)
    const weekday = orderDate.toLocaleString("en-US", { weekday: "long" }) as keyof typeof dailySalesByWeekday;
    if (dailySalesByWeekday[weekday] !== undefined) {
      dailySalesByWeekday[weekday] += order.totalAmount;
    }

    // Daily sales by exact date
    const dateKey = orderDate.toISOString().split('T')[0]; // YYYY-MM-DD
    dailySalesByDate.set(dateKey, (dailySalesByDate.get(dateKey) || 0) + order.totalAmount);
  }

  // Convert to arrays
  const monthlySalesArray = Object.entries(monthlySales).map(([month, sales]) => ({ month, sales }));
  const dailySalesArray = Object.entries(dailySalesByWeekday).map(([day, sales]) => ({ day, sales }));

  // Growth rate by month
  const calculateGrowthRateMonthly = (salesArray: { month: string; sales: number }[]): number => {
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const sorted = [...salesArray]
      .filter(m => m.sales > 0)
      .sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month));
    if (sorted.length < 2) return 0;
    const last = sorted[sorted.length - 1].sales;
    const prev = sorted[sorted.length - 2].sales;
    return prev === 0 ? 0 : parseFloat((((last - prev) / prev) * 100).toFixed(2));
  };

  // Growth rate by date
  const calculateGrowthRateDaily = (salesMap: Map<string, number>): number => {
    const sorted = Array.from(salesMap.entries())
      .map(([date, sales]) => ({ date, sales }))
      .filter(item => item.sales > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (sorted.length < 2) return 0;

    const prev = sorted[sorted.length - 2].sales;
    const last = sorted[sorted.length - 1].sales;
    return prev === 0 ? 0 : parseFloat((((last - prev) / prev) * 100).toFixed(2));
  };

  return {
    totalAmount: totalSales,
    growthRate: calculateGrowthRateMonthly(monthlySalesArray),
    growthRateDaily: calculateGrowthRateDaily(dailySalesByDate),
    monthlySales: monthlySalesArray,
    dailySales: dailySalesArray,
  };
};



// Dashboard controller for fetching sales and order summary for a given host
export const getDashboardData = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
  try {
    const hostId = req.params.hostId;
    if (!hostId) {
      return ErrorHandler.badUserInput(res, "Host ID is required.");
    }

    const orders = await OrderService.getAllOrders({ hostId: hostId, paymentStatus: "paid" });

    // Call the existing order summary function
    const orderSummary = calculateOrderSummary(orders);

    // Call the new sales summary function for each currency
    const nairaSales = calculateOverallSales(orders, "NGN");
    const dollarSales = calculateOverallSales(orders, "USD");

    const data = {
      overallSales: {
        naira: nairaSales,
        dollar: dollarSales,
      },
      ...orderSummary,
    };

    return sendResponse(res, 200, "Dashboard data fetched successfully", data);
  } catch (error) {
    return ErrorHandler.internalServerError(res, (error as Error).message);
  }
};





//------------------------------------------------------------------------------------------------------------------------------------------------------------//
// ADMIN DASHBOARD CONTROLLER 
//------------------------------------------------------------------------------------------------------------------------------------------------------------//



const getLastWeekDateRange = () => {
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);

  return { lastWeek, today };
};


// Function to get the admin dashboard data
export const getAdminDashboardData = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
  try {
    // const { lastWeek, today } = getLastWeekDateRange();
    const { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd } = getWeekRanges();

    // Run independent queries in parallel
    const [
      orders,
      events,
      totalOrder,
      totalEvents,
      totalHosts,
      thisWeekOrders,
      lastWeekOrder,
      thisWeekEvents,
      lastWeekEvents,
      thisWeekHosts,
      lastWeekHosts,
      platformFeeSummary,
      orderStatsAgg
    ] = await Promise.all([
      OrderService.getAllOrders({ paymentStatus: "paid" }),
      EventService.getEvents({}),
      OrderService.countOrders({ paymentStatus: "paid" }),
      EventService.countEvents(),
      UserService.countUsers({ role: "host" }),
      OrderService.countOrders({ paymentStatus: "paid", createdAt: { $gte: thisWeekStart, $lte: thisWeekEnd } }),
      OrderService.countOrders({ paymentStatus: "paid", createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd } }),
      EventService.countEvents({ createdAt: { $gte: thisWeekStart, $lte: thisWeekEnd } }),
      EventService.countEvents({ createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd } }),
      UserService.countUsers({ role: "host", createdAt: { $gte: thisWeekStart, $lte: thisWeekEnd } }),
      UserService.countUsers({ role: "host", createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd } }),
      FeeSummaryService.getPlatformFeeSummary(),
      OrderService.aggregateOrders()
    ]);

    const totalServiceFees = platformFeeSummary.totalPlatformFeeNGN;
    
    // Calculate growth
    // const calculateGrowth = (current: number, lastWeekValue: number): number => {
    //   if (lastWeekValue === 0) return current > 0 ? 100 : 0;
    //   return ((current - lastWeekValue) / lastWeekValue) * 100;
    // };

    const orderGrowth = calculateGrowthRate(thisWeekOrders, lastWeekOrder);
    const eventGrowth = calculateGrowthRate(thisWeekEvents, lastWeekEvents);
    const hostGrowth = calculateGrowthRate(thisWeekHosts, lastWeekHosts);
    const serviceFeeGrowth = calculateGrowthRate(platformFeeSummary.thisWeekPlatformFeeNGN, platformFeeSummary.lastWeekPlatformFeeNGN);

    // console.log("The Orders agregate: ", orderStatsAgg)

    // Order Stats
    let completed = 0, shipped = 0, pending = 0;
    const totalStatus = orderStatsAgg.reduce((sum: number, o: IOrderStatus) => sum + o.count, 0);

    orderStatsAgg.forEach((stat: IOrderStatus) => {
      if (stat._id === "delivered" || stat._id === "pickedUp") completed = (stat.count / totalStatus) * 100;
      if (stat._id === "shipped") shipped = (stat.count / totalStatus) * 100;
      if (stat._id === "pending") pending = (stat.count / totalStatus) * 100;
    });

    const orderStats = {
      completed: parseFloat(completed.toFixed(1)),
      completedOrders: completed,
      shipped: parseFloat(shipped.toFixed(1)),
      shippedOrders: shipped,
      pending: parseFloat(pending.toFixed(1)),
      pendingOrders: pending,
    };

    // Overall Sales
    const nairaSales = calculateOverallSales(orders, "NGN");
    const dollarSales = calculateOverallSales(orders, "USD");

    // Recent Events
    const recentEventsData = events.slice(0, 3);

    const structuredData: AdminDashboardData = {
      totalOrder: {
        value: totalOrder,
        growth: parseFloat(orderGrowth.toFixed(1)),
      },
      totalEvents: {
        value: totalEvents,
        growth: parseFloat(eventGrowth.toFixed(1)),
      },
      totalHosts: {
        value: totalHosts,
        growth: parseFloat(hostGrowth.toFixed(1)),
      },
      totalServiceFees: {
        value: parseFloat(totalServiceFees.toFixed(1)),
        growth: parseFloat(serviceFeeGrowth.toFixed(1)),
      },
      orderStats,
      overallSales: {
        naira: nairaSales,
        dollar: dollarSales,
      },
      recentEvents: recentEventsData,
    };

    return sendResponse(res, 200, "Admin dashboard data fetched successfully", structuredData);

  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
};
