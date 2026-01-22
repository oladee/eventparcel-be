import { getWeekRanges } from '../helpers/helpers';
import { FeeRecordModel } from '../models/feeRecordModel';
import { FeeSummary, PlatformFeeSummary } from "../interfaces/interface";


export class FeeSummaryService {
  // Method to get fee summary
  public static async getFeeSummary(): Promise<FeeSummary[]> {
    const raw = await FeeRecordModel.aggregate([
      {
        $group: {
          _id: "$currency",
          totalPlatformFees: { $sum: { $ifNull: ["$platformFee", 0] } },
          totalDeliveryFees: { $sum: { $ifNull: ["$deliveryFee", 0] } },
          totalTransactionFees: { $sum: { $ifNull: ["$transactionFee", 0] } },
          totalActualAmount: { $sum: { $ifNull: ["$actualAmount", 0] } },
          count: { $sum: 1 }
        }
      }
    ]);

    // Always include NGN and USD, even if not found
    const currencies = ["NGN", "USD"];

    const summary: FeeSummary[] = currencies.map(currency => {
      const match = raw.find(r => r._id === currency);
      return {
        _id: currency,
        totalPlatformFees: match?.totalPlatformFees || 0,
        totalDeliveryFees: match?.totalDeliveryFees || 0,
        totalTransactionFees: match?.totalTransactionFees || 0,
        totalActualAmount: match?.totalActualAmount || 0,
        count: match?.count || 0
      };
    });

    return summary;
  }


  public static async getPlatformFeeSummary(): Promise<PlatformFeeSummary> {
    const { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd } = getWeekRanges();

    const result = await FeeRecordModel.aggregate([
      {
        $facet: {
          totalPlatformFeeNGN: [
            { $match: { currency: "NGN" } },
            { $group: { _id: null, total: { $sum: "$platformFee" } } },
          ],
          totalPlatformFeeUSD: [
            { $match: { currency: "USD" } },
            { $group: { _id: null, total: { $sum: "$platformFee" } } },
          ],
          lastWeekPlatformFeeNGN: [
            {
              $match: {
                currency: "NGN",
                createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd },
              },
            },
            { $group: { _id: null, total: { $sum: "$platformFee" } } },
          ],
          thisWeekPlatformFeeNGN: [
            {
              $match: {
                currency: "NGN",
                createdAt: { $gte: thisWeekStart, $lte: thisWeekEnd },
              },
            },
            { $group: { _id: null, total: { $sum: "$platformFee" } } },
          ],
          lastWeekPlatformFeeUSD: [
            {
              $match: {
                currency: "USD",
                createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd },
              },
            },
            { $group: { _id: null, total: { $sum: "$platformFee" } } },
          ],
          thisWeekPlatformFeeUSD: [
            {
              $match: {
                currency: "USD",
                createdAt: { $gte: thisWeekStart, $lte: thisWeekEnd },
              },
            },
            { $group: { _id: null, total: { $sum: "$platformFee" } } },
          ],
        },
      },
      {
        $project: {
          totalPlatformFeeNGN: { $ifNull: [{ $arrayElemAt: ["$totalPlatformFeeNGN.total", 0] }, 0] },
          totalPlatformFeeUSD: { $ifNull: [{ $arrayElemAt: ["$totalPlatformFeeUSD.total", 0] }, 0] },
          lastWeekPlatformFeeNGN: { $ifNull: [{ $arrayElemAt: ["$lastWeekPlatformFeeNGN.total", 0] }, 0] },
          thisWeekPlatformFeeNGN: { $ifNull: [{ $arrayElemAt: ["$thisWeekPlatformFeeNGN.total", 0] }, 0] },
          lastWeekPlatformFeeUSD: { $ifNull: [{ $arrayElemAt: ["$lastWeekPlatformFeeUSD.total", 0] }, 0] },
          thisWeekPlatformFeeUSD: { $ifNull: [{ $arrayElemAt: ["$thisWeekPlatformFeeUSD.total", 0] }, 0] },
        },
      },
    ]);

    // result is an array with one element
    return result[0] as PlatformFeeSummary;
  }


  // Method to get weekly sales summary by currency for Admin Dashboard Trasaction Summary
  public static async getWeeklySalesSummaryByCurrency() {
    const { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd } = getWeekRanges();

    const [result] = await FeeRecordModel.aggregate([
      {
        $facet: {
          allTime: [
            {
              $group: {
                _id: "$currency",
                netSales: { $sum: "$actualAmount" },
                deliveryFee: { $sum: "$deliveryFee" },
                serviceFee: { $sum: { $add: ["$platformFee"] } },
                overallSales: { $sum: "$totalAmount" },
              },
            },
          ],
          thisWeek: [
            { $match: { createdAt: { $gte: thisWeekStart, $lte: thisWeekEnd } } },
            {
              $group: {
                _id: "$currency",
                netSales: { $sum: "$actualAmount" },
                deliveryFee: { $sum: "$deliveryFee" },
                serviceFee: { $sum: { $add: ["$platformFee"] } },
              },
            },
          ],
          lastWeek: [
            { $match: { createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd } } },
            {
              $group: {
                _id: "$currency",
                netSales: { $sum: "$actualAmount" },
                deliveryFee: { $sum: "$deliveryFee" },
                serviceFee: { $sum: { $add: ["$platformFee"] } },
              },
            },
          ],
        },
      },
    ]);

    const allTimeData = result.allTime || [];
    const thisWeekData = result.thisWeek || [];
    const lastWeekData = result.lastWeek || [];

    const currencies = ['NGN', 'USD'];

    const getChange = (current: number, previous: number): number => {
      if (!previous) return current ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const summary: Record<string, any> = {};

    for (const currency of currencies) {
      const all = allTimeData.find((d: any) => d._id === currency) || {};
      const thisWeek = thisWeekData.find((d: any) => d._id === currency) || {};
      const lastWeek = lastWeekData.find((d: any) => d._id === currency) || {};

      const netSales = all.netSales || 0;
      const deliveryFee = all.deliveryFee || 0;
      const serviceFee = all.serviceFee || 0;
      const overallSales = all.overallSales || 0;

      summary[currency] = {
        netSales,
        deliveryFee,
        serviceFee,
        overallSales,
        netPayout: overallSales - deliveryFee - serviceFee,
        netSalesChange: getChange(thisWeek.netSales || 0, lastWeek.netSales || 0),
        deliveryFeeChange: getChange(thisWeek.deliveryFee || 0, lastWeek.deliveryFee || 0),
        serviceFeeChange: getChange(thisWeek.serviceFee || 0, lastWeek.serviceFee || 0),
      };
    }

    return summary;
  }

}