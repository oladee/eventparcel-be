import { Types } from "mongoose";
import { paystack } from "../config/paystackConfig";
import { getPayPalAccessToken, paypalRest } from "../config/paypalConfig";
import hwClient from "../config/hyperwalletConfig";
import { UserService } from "./userServices";
import { hwAsync } from "../helpers/helpers";
import { WithdrawalModel } from "../models/withdrawalModel";
import { IWithdrawal, IHost } from "../interfaces/modelInterface";

export class WithdrawalService {
    // // Create a new withdrawal record
    // public static async createWithdrawal(userId: string, email: string, amount: number, currency: string): Promise<IWithdrawal> {
    //     const withdrawal = new WithdrawalModel({
    //         userId,
    //         reference: `TRANS-${Date.now()}`,
    //         email,
    //         amount,
    //         currency,
    //         status: "pending",
    //         // transferId: `TRANS-${Date.now()}`,
    //     });

    //     return await withdrawal.save();
    // }

    // Create a new withdrawal record
    public static async createWithdrawal(
      userId: string,
      email: string,
      amount: number,
      currency: string,
      transferId?: string // <-- add this
    ): Promise<IWithdrawal> {
      const withdrawal = new WithdrawalModel({
        userId,
        reference: `TRANS-${Date.now()}`,
        email,
        amount,
        currency,
        status: "pending",
        transferId, // <-- now saving it properly
      });

      return await withdrawal.save();
    }

    

   // Create a recipient for withdrawal
    static async createRecipient(name: string, accountNumber: string, bankCode: string, email: string) {
        try {
            const response = await paystack.post("/transferrecipient", {
                type: "nuban",
                name,
                account_number: accountNumber,
                bank_code: bankCode,
                currency: "NGN",
                email
            });
    
            if (response.data.status) {
                return response.data.data.recipient_code; // Save this in DB
            } else {
                throw new Error("Failed to create recipient");
            }
        } catch (error: any) {
            console.error("Error creating recipient:", error.response?.data);
            throw new Error(error.response?.data?.message || "Recipient creation failed");
        }
    }
    

    // Initiate a withdrawal with Paystack
    // static async initiateWithdrawal(userId: string, email: string, amount: number, currency: string, recipientCode: string) {
    //     try {
    //         // Create withdrawal record in DB
    //         const withdrawal = await this.createWithdrawal(userId, email, amount, currency);

    //         const response = await paystack.post(`/transfer`, {
    //             source: "balance",
    //             amount: amount * 100, // Convert to kobo (smallest currency unit)
    //             currency,
    //             recipient: recipientCode,
    //             reason: "Withdrawal request",
    //             reference: withdrawal.reference,
    //         });

    //         // Update withdrawal transferId in DB
    //         withdrawal.transferId = response.data.data.transfer_code;
    //         await withdrawal.save();

    //         return response.data.data;
    //     } catch (error: any) {
    //         console.error("Withdrawal initiation Error: ", error.response?.data);
    //         throw new Error(error.response?.data?.message || error.message || "Withdrawal initiation failed");
    //     }
    // }
    // Initiate a withdrawal with Paystack
    public static async initiateWithdrawal(
      userId: string,
      email: string,
      amount: number,
      currency: string,
      recipientCode: string
    ) {
      try {
      // First, initiate the Paystack transfer
      const response = await paystack.post(`/transfer`, {
        source: "balance",
        amount: amount * 100,
        currency,
        recipient: recipientCode,
        reason: "Withdrawal request",
      });

      const transferData = response.data.data;

      if (!transferData?.transfer_code) {
        throw new Error("Transfer failed: No transfer code returned.");
      }

    // Now create the withdrawal record with the transferId
    const withdrawal = await this.createWithdrawal(
      userId,
      email,
      amount,
      currency,
      transferData.transfer_code
    );

    return transferData;
  } catch (error: any) {
    console.error("❌ Withdrawal initiation Error: ", error.response?.data || error);
    throw new Error(error.response?.data?.message || error.message || "Withdrawal initiation failed");
  }
}



    // Initiate a withdrawal with PayPal
    static async initiatePaypalWithdrawal(userId: string, email: string, amount: number, currency: string) {
        try {
            // 1. Create the withdrawal record
            const withdrawal = await this.createWithdrawal(userId, email, amount, currency);
    
            // 2. Get Access Token
            const accessToken = await getPayPalAccessToken();
    
            // 3. Make Payout Request
            const response = await paypalRest.post(
                "/v1/payments/payouts",
                {
                    sender_batch_header: {
                        sender_batch_id: `batch-${Date.now()}`,
                        email_subject: "You have a payout!",
                    },
                    items: [
                        {
                            recipient_type: "EMAIL",
                            amount: {
                                value: amount.toFixed(2),
                                currency,
                            },
                            receiver: email,
                            note: "Withdrawal from VadTrans",
                            sender_item_id: withdrawal.transferId,
                        },
                    ],
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );
    
            // Optionally update the withdrawal with batch/payout info
            withdrawal.transferId = response.data.batch_header.payout_batch_id;
            await withdrawal.save();
    
            return response.data;
        } catch (error: any) {
            console.error("PayPal Withdrawal Error:", error.response?.data || error.message);
            throw new Error(error.response?.data?.message || error.message || "PayPal withdrawal failed");
        }
    }


    // Verify a withdrawal transaction
    static async verifyWithdrawal(reference: string) {
        try {
            const response = await paystack.get(`/transfer/verify/${reference}`);

            if (response.data.data.status === "success") {
                // Update withdrawal status in DB
                await WithdrawalModel.findOneAndUpdate(
                    { transferId: reference },
                    { status: "completed" },
                    { new: true }
                );

                return { success: true, data: response.data.data };
            } else {
                return { success: false, data: response.data.data };
            }
        } catch (error: any) {
            throw new Error(error.response?.data?.message || "Withdrawal verification failed");
        }
    }

    // Get Withdrawal by ID
    public static getWithdrawalById(id: string): Promise<IWithdrawal | null> {
        return WithdrawalModel.findById(id).populate("userId");
    }

    // Get Withdrawal by Field
    public static getWithdrawalByField(filter: any = {}): Promise<IWithdrawal | null> {
        return WithdrawalModel.findOne(filter).populate("userId");
    }

    // Get all Withdrawals
    public static getAllWithdrawals(filter: any = {}, skip = 0, limit = 10): Promise<IWithdrawal[]> {
        return WithdrawalModel.find(filter)
            .populate("userId")
            .skip(skip)
            .limit(limit);
    }




    //----------------------------------------------------------------------------------------------------------------------------------------------//
    //----------------------------------------------------------------------------------------------------------------------------------------------//

    // Create Hyperwallet User (only once per user)
  static async createHWUser(user: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    dob?: string;
  }) {
    const existingUser = await UserService.getUserById(user._id) as IHost;

    if (existingUser?.isHyperwalletVerified && existingUser?.hyperwalletToken) {
      return { token: existingUser.hyperwalletToken };
    }
  
    // Proceed to create a new Hyperwallet user
    const hwUser = await hwAsync<{ token: string }>(hwClient.createUser.bind(hwClient), {
      clientUserId: user._id.toString(),
      profileType: "INDIVIDUAL",
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      addressLine1: user.address || "123 Main St",
      city: user.city || "Los Angeles",
      stateProvince: user.state || "CA",
      country: user.country || "US",
      postalCode: user.postalCode || "90001",
      dateOfBirth: user.dob || "1990-01-01",
    });

      // Save Hyperwallet user token and verification flag
      await UserService.updateUserById(user._id, {
      hyperwalletToken: hwUser.token,
      isHyperwalletVerified: true,
    });

    return hwUser;
  }

  // Add Bank Account
  static async linkBankAccount(
    hwUserToken: string,
    accountDetails: {
      bankCode: string;
      accountNumber: string;
    }
  ): Promise<{ token: string }> {
    const bankAccount = await hwAsync(hwClient.createBankAccount.bind(hwClient), hwUserToken, {
      transferMethodCountry: "US",
      transferMethodCurrency: "USD",
      type: "BANK_ACCOUNT",
      bankAccountPurpose: "CHECKING",
      branchId: accountDetails.bankCode,
      bankId: accountDetails.bankCode,
      accountNumber: accountDetails.accountNumber,
    });

    return bankAccount as { token: string };
  }

  // Initiate Withdrawal
  static async initiateHyperwalletWithdrawal(
    user: {
      _id: string;
      email: string;
      firstName: string;
      lastName: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      dob?: string;
    },
    amount: number,
    accountDetails: {
      bankCode: string;
      accountNumber: string;
    }
  ) {
    const hwUser = await this.createHWUser(user);
    const bankAccount = await this.linkBankAccount(hwUser.token, accountDetails);

    const withdrawal = new WithdrawalModel({
      userId: user._id,
      email: user.email,
      amount,
      currency: "USD",
      status: "pending",
      transferId: `HW-${Date.now()}`,
    });

    await withdrawal.save();

    const payment = await hwAsync(hwClient.createPayment.bind(hwClient), {
      destinationToken: bankAccount.token,
      clientPaymentId: withdrawal.transferId,
      amount: amount.toFixed(2),
      currency: "USD",
      purpose: "OTHER",
    });

    return {
      success: true,
      withdrawal,
      payment,
    };
  }



  public static async calculateHostPayouts(
  hostId: string | null = null,
  status: string | null = null
) {
  try {
    const matchConditions: any = {};

    if (hostId) {
      matchConditions.userId = new Types.ObjectId(hostId);
    }

    if (status) {
      matchConditions.withdrawalStatus = status;
    }

    const aggregationPipeline = [
      {
        $match: matchConditions,
      },
      {
        $group: {
          _id: {
            userId: "$userId",
            currency: "$currency",
          },
          totalAmount: { $sum: "$amount" },
        },
      },
      {
        $group: {
          _id: "$_id.userId",
          currencyMap: {
            $push: {
              currency: "$_id.currency",
              total: "$totalAmount",
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $unwind: "$userInfo",
      },
      {
        $project: {
          hostId: "$_id",
          user: {
            firstName: "$userInfo.firstName",
            lastName: "$userInfo.lastName",
            email: "$userInfo.email",
            role: "$userInfo.role",
          },
          currencyBreakdown: {
            $let: {
              vars: {
                existing: "$currencyMap",
              },
              in: {
                $concatArrays: [
                  {
                    $cond: [
                      {
                        $in: ["NGN", { $map: { input: "$$existing", as: "c", in: "$$c.currency" } }],
                      },
                      [],
                      [{ currency: "NGN", total: 0 }],
                    ],
                  },
                  {
                    $cond: [
                      {
                        $in: ["USD", { $map: { input: "$$existing", as: "c", in: "$$c.currency" } }],
                      },
                      [],
                      [{ currency: "USD", total: 0 }],
                    ],
                  },
                  "$$existing",
                ],
              },
            },
          },
        },
      },
    ];

    return await WithdrawalModel.aggregate(aggregationPipeline);
  } catch (error) {
    console.error("❌ Error calculating host payouts:", error);
    throw error;
  }
}



// Function to get the Total Payout for all Host for Admin 
public static async calculateTotalPayoutsForAdmin(status: string | null = null) {
  try {
    const matchConditions: any = {};

    if (status) {
      matchConditions.withdrawalStatus = status;
    }

    const aggregationPipeline = [
      {
        $match: matchConditions,
      },
      {
        $group: {
          _id: "$currency",
          totalAmount: { $sum: "$amount" },
        },
      },
      {
        $addFields: {
          currency: "$_id",
        },
      },
      {
        $project: {
          _id: 0,
          currency: 1,
          totalAmount: 1,
        },
      },
      // Ensure both NGN and USD are always present
      {
        $facet: {
          data: [
            {
              $match: {},
            },
          ],
          ngn: [
            {
              $match: { currency: "NGN" },
            },
          ],
          usd: [
            {
              $match: { currency: "USD" },
            },
          ],
        },
      },
      {
        $project: {
          all: {
            $concatArrays: [
              {
                $cond: [
                  { $gt: [{ $size: "$ngn" }, 0] },
                  [],
                  [{ currency: "NGN", totalAmount: 0 }],
                ],
              },
              {
                $cond: [
                  { $gt: [{ $size: "$usd" }, 0] },
                  [],
                  [{ currency: "USD", totalAmount: 0 }],
                ],
              },
              "$data",
            ],
          },
        },
      },
      {
        $unwind: "$all",
      },
      {
        $replaceRoot: { newRoot: "$all" },
      },
    ];

    return await WithdrawalModel.aggregate(aggregationPipeline);
  } catch (error) {
    console.error("❌ Error calculating total payouts:", error);
    throw error;
  }
}



}
