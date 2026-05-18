import { paystack } from "../config/paystackConfig";
import * as paypal from "@paypal/checkout-server-sdk";
import { paypalClient } from "../config/paypalConfig";
import { PaymentModel } from "../models/paymentModel";
import { IPayment } from "../interfaces/modelInterface";
import {
  INormalizedPaymentEvent,
  IPaypalCapture,
  IPaypalCaptureResponse,
} from "../interfaces/interface";
import mongoose from "mongoose";
import { calculateGrowthRate } from "../helpers/helpers";

class PaymentService {
  private static getFirstPaypalCapture(
    order: IPaypalCaptureResponse
  ): IPaypalCapture | undefined {
    return order.purchase_units?.flatMap(
      (unit) => unit.payments?.captures ?? []
    )[0];
  }

  private static normalizeCapturedPaypalOrder(
    order: IPaypalCaptureResponse
  ): INormalizedPaymentEvent {
    const capture = this.getFirstPaypalCapture(order);
    const purchaseUnit = order.purchase_units?.[0];
    const amount = capture?.amount ?? purchaseUnit?.amount;

    if (!capture || !amount) {
      throw new Error("PayPal capture response is missing captured payment details");
    }

    return {
      reference: order.id,
      amount: parseFloat(amount.value),
      currency: amount.currency_code,
      email: order.payer?.email_address ?? "",
      provider: "paypal",
      status: capture.status ?? order.status,
      transfer_code: capture.id,
      fees: capture.seller_receivable_breakdown?.paypal_fee
        ? parseFloat(capture.seller_receivable_breakdown.paypal_fee.value)
        : undefined,
    };
  }

  private static async getPaypalOrderDetails(
    orderId: string
  ): Promise<IPaypalCaptureResponse> {
    const request = new paypal.orders.OrdersGetRequest(orderId);
    const response = (await paypalClient.execute(request)) as {
      result: IPaypalCaptureResponse;
    };

    return response.result;
  }

  // Create a new payment record
  static async createPayment(
    orderId: string,
    hostId: string,
    email: string,
    amount: number,
    currency?: string
  ): Promise<IPayment> {
    // Check if the payment already exists with the same orderId and hostId
    const existingPayment = await PaymentModel.findOne({ orderId, hostId });
    if (existingPayment) {
      throw new Error("Payment record already exists for this order and host.");
    }

    const payment = new PaymentModel({
      orderId,
      hostId,
      guestEmail: email,
      amount,
      currency: currency || "NGN",
      paymentStatus: "pending",
      paymentReference: `REF-${Date.now()}`,
    });

    return await payment.save();
  }

  static async createPaymentNew(
    orderId: string,
    hostId: string,
    email: string,
    amount: number,
    paymentStatus: string,
    currency?: string
  ): Promise<IPayment> {
    const payment = new PaymentModel({
      orderId,
      hostId,
      guestEmail: email,
      amount,
      currency: currency || "NGN",
      paymentStatus: paymentStatus || "pending",
      paymentReference: `REF-${Date.now()}`,
    });

    return await payment.save();
  }

  // Initiate a payment with Paystack
  static async initiatePayment(
    email: string,
    amount: number,
    orderId: string,
    hostId: string
  ) {
    try {
      // Create payment record in DB
      const payment = await this.createPayment(orderId, hostId, email, amount);

      const response = await paystack.post(`/transaction/initialize`, {
        email,
        amount: Math.round(amount * 100), // Convert to kobo (smallest currency unit, must be integer)
        reference: payment.paymentReference, // Use payment record ID as reference
        callback_url: `${process.env.CLIENT_URL}/orderSuccessful?orderId=${orderId}`,
        // bearer: "account", // "customer" or "account"
      });

      // Update payment reference in DB
      payment.paymentReference = response.data.data.reference;
      await payment.save();

      return {
        paymentLink: response.data.data.authorization_url,
        reference: response.data.data.reference,
      }; // Return payment link

    } catch (error: any) {
      console.error("Payment initialization Error: ", error.response?.data);
      throw new Error(
        error.response?.data?.message ||
        error.message ||
        "Payment initiation failed"
      );
    }
  }

  // Initiate a payment with PayPal (supports USD, GBP, etc.)
  static async initiatePaymentPaypal(
    email: string,
    amount: number,
    orderId: string,
    hostId: string,
    currencyCode: string = "USD"
  ) {
    try {
      const upper = (currencyCode || "USD").toUpperCase();
      const payment = await this.createPayment(
        orderId,
        hostId,
        email,
        amount,
        upper
      );

      // Create PayPal order
      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer("return=representation");
      request.requestBody({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: payment.paymentReference,
            amount: {
              currency_code: upper,
              value: amount.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: "Event_Parcel",
          // landing_page: "BILLING",
          shipping_preference: "NO_SHIPPING", // Optional but helpful
          user_action: "PAY_NOW",
          return_url: `${process.env.CLIENT_URL}/orderSuccessful?orderId=${orderId}`,
          cancel_url: `${process.env.CLIENT_URL}/orderCancelled?orderId=${orderId}`,
        },
      });

      const order = await paypalClient.execute(request);

      // Save PayPal order ID as payment reference
      payment.paymentReference = order.result.id;
      await payment.save();

      // Extract approval URL
      const approvalUrl = order.result.links.find(
        (link: { rel: string; href: string }) => link.rel === "approve"
      )?.href;

      return {
        paymentLink: approvalUrl,
        reference: order.result.id,
      };

    } catch (error: any) {
      console.error("PayPal payment initiation error:", error);
      throw new Error(error.message || "PayPal payment initiation failed");
    }
  }

  static async capturePaypalOrder(
    orderId: string
  ): Promise<INormalizedPaymentEvent> {
    try {
      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      const response = (await paypalClient.execute(request)) as {
        result: IPaypalCaptureResponse;
      };

      return this.normalizeCapturedPaypalOrder(response.result);
    } catch (error: any) {
      if (error?.statusCode === 409 || error?.statusCode === 422) {
        const existingOrder = await this.getPaypalOrderDetails(orderId);
        const existingCapture = this.getFirstPaypalCapture(existingOrder);

        if (existingCapture) {
          return this.normalizeCapturedPaypalOrder(existingOrder);
        }
      }

      const details = error?.result?.details
        ?.map((detail: { description?: string }) => detail.description)
        .filter(Boolean)
        .join("; ");

      throw new Error(details || error?.message || "PayPal payment capture failed");
    }
  }

  // Verify a payment
  static async verifyPayment(reference: string) {
    try {
      const response = await paystack.get(`/transaction/verify/${reference}`);

      if (response.data.data.status === "success") {
        // Update payment status in DB
        await PaymentModel.findOneAndUpdate(
          { reference },
          { status: "Paid" },
          { new: true }
        );

        return { success: true, data: response.data.data };
      } else {
        return { success: false, data: response.data.data };
      }
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Payment verification failed"
      );
    }
  }

  // Resolve Nigerian bank account number
  static async validateBankAccount(accountNumber: string, bankCode: string) {
    try {
      const response = await paystack.get(`/bank/resolve`, {
        params: { account_number: accountNumber, bank_code: bankCode },
      });

      if (response.data.status) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, message: "Account verification failed" };
      }
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Bank account verification failed"
      );
    }
  }

  // Get Paystack Balance
  static async checkPaystackBalance(currency = "NGN"): Promise<number> {

    const response = await paystack.get(`/balance`);

    const wallet = response.data?.data?.find((b: any) => b.currency === currency);
    if (!wallet) throw new Error(`Balance for ${currency} not found`);

    return wallet.balance;
  }


  // Get Payment by ID
  public static getPaymentById(id: string): Promise<IPayment | null> {
    return PaymentModel.findById(id)
      .populate({
        path: "hostId",
        model: "User",
        select: "firstName lastName email phoneNumber imageUrl role",
      })
      .populate({
        path: "orderId",
        model: "Order",
      });
  }

  // Get Payment by Field
  public static getPaymentByField(filter: any = {}): Promise<IPayment | null> {
    return PaymentModel.findOne(filter)
      .populate({
        path: "hostId",
        model: "User",
        select: "firstName lastName email phoneNumber imageUrl role",
      })
      .populate({
        path: "orderId",
        model: "Order",
      });
  }

  // Get all Payment
  public static getAllPayments(
    filter: any = {},
    skip = 0,
    limit = 10
  ): Promise<IPayment[]> {
    return PaymentModel.find(filter)
      .populate({
        path: "hostId",
        model: "User",
        select: "firstName lastName email phoneNumber imageUrl role",
      })
      .populate({
        path: "orderId",
        model: "Order",
        populate: {
          path: "eventId",
          model: "Event",
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  // Count all payments
  public static async countPayments(filter: any) {
    return PaymentModel.countDocuments(filter);
  }

  // Get Host Payout By EventId 
  public static async getPaymentSummaryByEventPayout(eventId: string) {
    const eventObjectId = new mongoose.Types.ObjectId(eventId);

    const pipeline = [
      {
        $match: {
          paymentStatus: "paid"
        }
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order"
        }
      },
      { $unwind: "$order" },
      {
        $match: {
          "order.eventId": eventObjectId
        }
      },
      {
        $group: {
          _id: "$currency",
          totalAmount: { $sum: "$amount" },
          hostShare: { $sum: { $ifNull: ["$hostShare", 0] } },
          platformFee: { $sum: { $ifNull: ["$platformFee", 0] } },
          transactionFee: { $sum: { $ifNull: ["$transactionFee", 0] } },
          tax: { $sum: { $ifNull: ["$order.tax", 0] } },
          homeDeliveryFee: { $sum: { $ifNull: ["$order.homeDeliveryFee", 0] } },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          currency: "$_id",
          totalAmount: 1,
          platformFee: 1,
          transactionFee: 1,
          tax: 1,
          homeDeliveryFee: 1,
          count: 1,
          payout: "$hostShare" // hostShare is the payout
        }
      }
    ];

    const result = await PaymentModel.aggregate(pipeline);
    return result;
  }



  // Get all Payments using aggregation to filter by order fields
  public static async getAllPaymentsNew2(filter: any = {}, skip = 0, limit = 10): Promise<IPayment[]> {
    const matchStage: any = {
      hostId: new mongoose.Types.ObjectId(filter.hostId),
    };

    if (filter.paymentStatus) {
      matchStage.paymentStatus = filter.paymentStatus;
    }

    const pipeline: any[] = [
      // Later in the pipeline
      {
        $match: matchStage
      },
      // {
      //   $match: {
      //     hostId: new mongoose.Types.ObjectId(filter.hostId),
      //     paymentStatus: filter.paymentStatus ?? '',
      //   },
      // },
      {
        $lookup: {
          from: "orders", // Actual collection name, usually lowercase plural
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      {
        $unwind: "$order",
      },
      {
        $lookup: {
          from: "events",
          localField: "order.eventId",
          foreignField: "_id",
          as: "order.event",
        },
      },
      {
        $unwind: {
          path: "$order.event",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    // Optional $match for search
    if (filter.searchConditions) {
      pipeline.push({
        $match: {
          $or: filter.searchConditions,
        },
      });
    }

    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    );

    return PaymentModel.aggregate(pipeline);
  }


  public static async countPaymentsNew2(filter: any): Promise<number> {
    const matchStage: any = {
      hostId: new mongoose.Types.ObjectId(filter.hostId),
    };

    if (filter.paymentStatus) {
      matchStage.paymentStatus = filter.paymentStatus;
    }

    const pipeline: any[] = [
      // {
      //   $match: {
      //     hostId: new mongoose.Types.ObjectId(filter.hostId),
      //     paymentStatus: 'paid',
      //   },
      // },
      {
        $match: matchStage
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      {
        $unwind: "$order",
      },
    ];

    if (filter.searchConditions) {
      pipeline.push({
        $match: {
          $or: filter.searchConditions,
        },
      });
    }

    pipeline.push({
      $count: "total",
    });

    const result = await PaymentModel.aggregate(pipeline);
    return result[0]?.total || 0;
  }



  // Get all payment history summary for a host
  public static async getPaymentSummaryByHost(hostId: string) {
    const objectId = new mongoose.Types.ObjectId(hostId);

    const pipeline = [
      {
        $match: {
          hostId: objectId,
          paymentStatus: "paid", // Only include paid payments
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
      {
        $facet: {
          netSalesByCurrency: [
            {
              $group: {
                _id: "$order.totalAmountCurrency",
                // netSales: { $sum: "$amount" },
                netSales: {
                  $sum: {
                    $subtract: [
                      "$order.totalAmount",
                      // { $add: ["$order.tax", "$order.homeDeliveryFee"] }
                      {
                        $add: [
                          { $ifNull: ["$order.tax", 0] },
                          { $ifNull: ["$order.homeDeliveryFee", 0] }
                        ]
                      }
                    ],
                  },
                }
              },
            },
          ],
          overallSalesByCurrency: [
            {
              $group: {
                _id: "$order.totalAmountCurrency",
                overallSales: { $sum: "$order.totalAmount" },
              },
            },
          ],
        },
      },
      {
        $project: {
          summaryByCurrency: {
            $map: {
              input: {
                $filter: {
                  input: {
                    $setUnion: [
                      {
                        $map: {
                          input: "$netSalesByCurrency",
                          as: "n",
                          in: "$$n._id",
                        },
                      },
                      {
                        $map: {
                          input: "$overallSalesByCurrency",
                          as: "o",
                          in: "$$o._id",
                        },
                      },
                    ],
                  },
                  as: "currency",
                  cond: { $ne: ["$$currency", null] }, // Ensure no nulls
                },
              },
              as: "currency",
              in: {
                k: "$$currency",
                v: {
                  netSales: {
                    $ifNull: [
                      {
                        $first: {
                          $map: {
                            input: {
                              $filter: {
                                input: "$netSalesByCurrency",
                                cond: { $eq: ["$$this._id", "$$currency"] },
                              },
                            },
                            as: "ns",
                            in: "$$ns.netSales",
                          },
                        },
                      },
                      0,
                    ],
                  },
                  overallSales: {
                    $ifNull: [
                      {
                        $first: {
                          $map: {
                            input: {
                              $filter: {
                                input: "$overallSalesByCurrency",
                                cond: { $eq: ["$$this._id", "$$currency"] },
                              },
                            },
                            as: "os",
                            in: "$$os.overallSales",
                          },
                        },
                      },
                      0,
                    ],
                  },
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          summaryByCurrency: { $arrayToObject: "$summaryByCurrency" },
        },
      },
      {
        $project: {
          summaryByCurrency: {
            NGN: "$summaryByCurrency.NGN",
            USD: "$summaryByCurrency.USD",
          },
        },
      },
    ];

    const result = await PaymentModel.aggregate(pipeline);

    return result.length
      ? result[0]
      : {
        summaryByCurrency: {
          NGN: { netSales: 0, overallSales: 0 },
          USD: { netSales: 0, overallSales: 0 },
        },
      };
  }

  // Get all payment history summary
  // public static async getPaymentSummary() {
  //     const pipeline = [
  //       {
  //         $match: {
  //           paymentStatus: "paid", // Only include paid payments
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "orders",
  //           localField: "orderId",
  //           foreignField: "_id",
  //           as: "order",
  //         },
  //       },
  //       { $unwind: "$order" },
  //       {
  //         $facet: {
  //           netSalesByCurrency: [
  //             {
  //               $group: {
  //                 _id: "$currency",
  //                 netSales: { $sum: "$amount" },
  //               },
  //             },
  //           ],
  //           overallSalesByCurrency: [
  //             {
  //               $group: {
  //                 _id: "$order.totalAmountCurrency",
  //                 overallSales: { $sum: "$order.totalAmount" },
  //               },
  //             },
  //           ],
  //         },
  //       },
  //       {
  //         $project: {
  //           summaryByCurrency: {
  //             $map: {
  //               input: {
  //                 $filter: {
  //                   input: {
  //                     $setUnion: [
  //                       { $map: { input: "$netSalesByCurrency", as: "n", in: "$$n._id" } },
  //                       { $map: { input: "$overallSalesByCurrency", as: "o", in: "$$o._id" } },
  //                     ],
  //                   },
  //                   as: "currency",
  //                   cond: { $ne: ["$$currency", null] }, // remove null keys
  //                 },
  //               },
  //               as: "currency",
  //               in: {
  //                 k: "$$currency",
  //                 v: {
  //                   netSales: {
  //                     $ifNull: [
  //                       {
  //                         $first: {
  //                           $map: {
  //                             input: {
  //                               $filter: {
  //                                 input: "$netSalesByCurrency",
  //                                 cond: { $eq: ["$$this._id", "$$currency"] },
  //                               },
  //                             },
  //                             as: "ns",
  //                             in: "$$ns.netSales",
  //                           },
  //                         },
  //                       },
  //                       0,
  //                     ],
  //                   },
  //                   overallSales: {
  //                     $ifNull: [
  //                       {
  //                         $first: {
  //                           $map: {
  //                             input: {
  //                               $filter: {
  //                                 input: "$overallSalesByCurrency",
  //                                 cond: { $eq: ["$$this._id", "$$currency"] },
  //                               },
  //                             },
  //                             as: "os",
  //                             in: "$$os.overallSales",
  //                           },
  //                         },
  //                       },
  //                       0,
  //                     ],
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $addFields: {
  //           summaryByCurrency: { $arrayToObject: "$summaryByCurrency" },
  //         },
  //       },
  //       {
  //         $project: {
  //           summaryByCurrency: {
  //             NGN: "$summaryByCurrency.NGN",
  //             USD: "$summaryByCurrency.USD",
  //           },
  //         },
  //       },
  //     ];

  //     const result = await PaymentModel.aggregate(pipeline);

  //     return result.length
  //       ? result[0]
  //       : {
  //           summaryByCurrency: {
  //             NGN: { netSales: 0, overallSales: 0 },
  //             USD: { netSales: 0, overallSales: 0 },
  //           },
  //         };
  // }

  public static async getAllPaymentsNew(
    baseFilter: Record<string, any>,
    skip: number,
    limit: number,
    searchConditions: Record<string, any>[] = []
  ) {
    const pipeline: any[] = [
      { $match: baseFilter },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
    ];

    if (searchConditions.length) {
      pipeline.push({ $match: { $or: searchConditions } });
    }

    pipeline.push({ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit });

    return PaymentModel.aggregate(pipeline);
  }

  public static async countPaymentsNew(
    baseFilter: Record<string, any>,
    searchConditions: Record<string, any>[] = []
  ) {
    const pipeline: any[] = [
      { $match: baseFilter },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
    ];

    if (searchConditions.length) {
      pipeline.push({ $match: { $or: searchConditions } });
    }

    pipeline.push({ $count: "total" });

    const result = await PaymentModel.aggregate(pipeline);
    return result[0]?.total || 0;
  }

  // public static async getPaymentSummary() {
  //   const now = new Date();
  //   const lastWeek = new Date();
  //   lastWeek.setDate(now.getDate() - 7);

  //   const thisWeekMatch = {
  //     paymentStatus: "paid",
  //     createdAt: { $gte: lastWeek, $lte: now },
  //   };
  //   const lastWeekMatch = {
  //     paymentStatus: "paid",
  //     createdAt: {
  //       $gte: new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000),
  //       $lt: lastWeek,
  //     },
  //   };

  //   const pipeline = [
  //     {
  //       $facet: {
  //         thisWeek: [
  //           { $match: thisWeekMatch },
  //           {
  //             $lookup: {
  //               from: "orders",
  //               localField: "orderId",
  //               foreignField: "_id",
  //               as: "order",
  //             },
  //           },
  //           { $unwind: "$order" },
  //           {
  //             $group: {
  //               _id: "$currency",
  //               netSales: { $sum: "$amount" },
  //               deliveryFee: { $sum: "$order.homeDeliveryFee" },
  //               serviceFee: { $sum: "$order.tax" },
  //               overallSales: { $sum: "$order.totalAmount" },
  //             },
  //           },
  //         ],
  //         lastWeek: [
  //           { $match: lastWeekMatch },
  //           {
  //             $lookup: {
  //               from: "orders",
  //               localField: "orderId",
  //               foreignField: "_id",
  //               as: "order",
  //             },
  //           },
  //           { $unwind: "$order" },
  //           {
  //             $group: {
  //               _id: "$currency",
  //               netSales: { $sum: "$amount" },
  //               deliveryFee: { $sum: "$order.homeDeliveryFee" },
  //               serviceFee: { $sum: "$order.tax" },
  //               overallSales: { $sum: "$order.totalAmount" },
  //             },
  //           },
  //         ],
  //       },
  //     },
  //   ];

  //   const result = await PaymentModel.aggregate(pipeline);
  //   console.log("The Results: ", JSON.stringify(result, null, 2));

  //   const summary = {
  //     NGN: {
  //       current: result[0].thisWeek.find(
  //         (x: { _id: string }) => x._id === "NGN"
  //       ) || { netSales: 0, deliveryFee: 0, serviceFee: 0, overallSales: 0 },
  //       previous: result[0].lastWeek.find(
  //         (x: { _id: string }) => x._id === "NGN"
  //       ) || { netSales: 0, deliveryFee: 0, serviceFee: 0, overallSales: 0 },
  //     },
  //     USD: {
  //       current: result[0].thisWeek.find(
  //         (x: { _id: string }) => x._id === "USD"
  //       ) || { netSales: 0, deliveryFee: 0, serviceFee: 0, overallSales: 0 },
  //       previous: result[0].lastWeek.find(
  //         (x: { _id: string }) => x._id === "USD"
  //       ) || { netSales: 0, deliveryFee: 0, serviceFee: 0, overallSales: 0 },
  //     },
  //   };

  //   return {
  //     summaryByCurrency: {
  //       NGN: {
  //         netSales: summary.NGN.current.netSales,
  //         netSalesChange: calculateGrowthRate(
  //           summary.NGN.current.netSales,
  //           summary.NGN.previous.netSales
  //         ),
  //         deliveryFee: summary.NGN.current.deliveryFee,
  //         deliveryFeeChange: calculateGrowthRate(
  //           summary.NGN.current.deliveryFee,
  //           summary.NGN.previous.deliveryFee
  //         ),
  //         serviceFee: summary.NGN.current.serviceFee,
  //         serviceFeeChange: calculateGrowthRate(
  //           summary.NGN.current.serviceFee,
  //           summary.NGN.previous.serviceFee
  //         ),
  //         overallSales: summary.NGN.current.overallSales,
  //       },
  //       USD: {
  //         netSales: summary.USD.current.netSales,
  //         netSalesChange: calculateGrowthRate(
  //           summary.USD.current.netSales,
  //           summary.USD.previous.netSales
  //         ),
  //         deliveryFee: summary.USD.current.deliveryFee,
  //         deliveryFeeChange: calculateGrowthRate(
  //           summary.USD.current.deliveryFee,
  //           summary.USD.previous.deliveryFee
  //         ),
  //         serviceFee: summary.USD.current.serviceFee,
  //         serviceFeeChange: calculateGrowthRate(
  //           summary.USD.current.serviceFee,
  //           summary.USD.previous.serviceFee
  //         ),
  //         overallSales: summary.USD.current.overallSales,
  //       },
  //     },
  //   };
  // }


  public static async getPaymentSummary() {
    const now = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(now.getDate() - 7);

    const thisWeekMatch = {
      paymentStatus: "paid",
      createdAt: { $gte: lastWeek, $lte: now },
    };
    const lastWeekMatch = {
      paymentStatus: "paid",
      createdAt: {
        $gte: new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000),
        $lt: lastWeek,
      },
    };

    const pipeline = [
      {
        $facet: {
          allTime: [
            { $match: { paymentStatus: "paid" } },
            {
              $lookup: {
                from: "orders",
                localField: "orderId",
                foreignField: "_id",
                as: "order",
              },
            },
            { $unwind: "$order" },
            {
              $group: {
                _id: "$currency",
                netSales: { $sum: "$amount" },
                deliveryFee: { $sum: "$order.homeDeliveryFee" },
                transactionFee: { $sum: "$transactionFee" }, // Sum of transaction fees (if needed)
                serviceFee: {
                  $sum: {
                    $cond: [
                      { $eq: ["$currency", "NGN"] },
                      { $multiply: [{ $subtract: ["$amount", { $add: ["$order.homeDeliveryFee", "$transactionFee"] }] }, 0.07] },
                      { $multiply: [{ $subtract: ["$amount", { $add: ["$order.homeDeliveryFee", "$transactionFee"] }] }, 0.085] }
                    ]
                  }
                },
                overallSales: { $sum: "$order.totalAmount" },
              },
            },
          ],
          thisWeek: [
            { $match: thisWeekMatch },
            {
              $lookup: {
                from: "orders",
                localField: "orderId",
                foreignField: "_id",
                as: "order",
              },
            },
            { $unwind: "$order" },
            {
              $group: {
                _id: "$currency",
                netSales: { $sum: "$amount" },
                deliveryFee: { $sum: "$order.homeDeliveryFee" },
                transactionFee: { $sum: "$transactionFee" }, // Sum of transaction fees (if needed)
                serviceFee: {
                  $sum: {
                    $cond: [
                      { $eq: ["$currency", "NGN"] },
                      { $multiply: [{ $subtract: ["$amount", { $add: ["$order.homeDeliveryFee", "$transactionFee"] }] }, 0.07] },
                      { $multiply: [{ $subtract: ["$amount", { $add: ["$order.homeDeliveryFee", "$transactionFee"] }] }, 0.085] }
                    ]
                  }
                },
                overallSales: { $sum: "$order.totalAmount" },
              },
            },
          ],
          lastWeek: [
            { $match: lastWeekMatch },
            {
              $lookup: {
                from: "orders",
                localField: "orderId",
                foreignField: "_id",
                as: "order",
              },
            },
            { $unwind: "$order" },
            {
              $group: {
                _id: "$currency",
                netSales: { $sum: "$amount" },
                deliveryFee: { $sum: "$order.homeDeliveryFee" },
                transactionFee: { $sum: "$transactionFee" }, // Sum of transaction fees (if needed)
                serviceFee: {
                  $sum: {
                    $cond: [
                      { $eq: ["$currency", "NGN"] },
                      { $multiply: [{ $subtract: ["$amount", { $add: ["$order.homeDeliveryFee", "$transactionFee"] }] }, 0.07] },
                      { $multiply: [{ $subtract: ["$amount", { $add: ["$order.homeDeliveryFee", "$transactionFee"] }] }, 0.085] }
                    ]
                  }
                },
                overallSales: { $sum: "$order.totalAmount" },
              },
            },
          ],
        },
      },
    ];


    const result = await PaymentModel.aggregate(pipeline);

    interface CurrencyData {
      _id: string;
      netSales: number;
      netPayout?: number;
      deliveryFee: number;
      serviceFee: number;
      overallSales: number;
    }

    function getByCurrency(data: CurrencyData[], currency: string): CurrencyData {
      return (
        data.find((x) => x._id === currency) || {
          _id: currency,
          netSales: 0,
          deliveryFee: 0,
          serviceFee: 0,
          overallSales: 0,
          netPayout: 0,
        }
      );
    }

    const currencies = ["NGN", "USD"];
    const summaryByCurrency: Record<
      string,
      {
        netSales: number;
        netPayout?: number;
        netSalesChange: number;
        deliveryFee: number;
        deliveryFeeChange: number;
        serviceFee: number;
        serviceFeeChange: number;
        overallSales: number;
      }
    > = {};

    currencies.forEach((currency) => {
      const all = getByCurrency(result[0].allTime, currency);
      const current = getByCurrency(result[0].thisWeek, currency);
      const previous = getByCurrency(result[0].lastWeek, currency);

      summaryByCurrency[currency] = {
        netSales: all.netSales,
        netSalesChange: calculateGrowthRate(current.netSales, previous.netSales),
        deliveryFee: all.deliveryFee,
        deliveryFeeChange: calculateGrowthRate(current.deliveryFee, previous.deliveryFee),
        serviceFee: all.serviceFee,
        serviceFeeChange: calculateGrowthRate(current.serviceFee, previous.serviceFee),
        overallSales: all.overallSales,
        netPayout: all.overallSales - (all.deliveryFee + all.serviceFee),
      };
    });

    return { summaryByCurrency };

  }

}

export default PaymentService;
