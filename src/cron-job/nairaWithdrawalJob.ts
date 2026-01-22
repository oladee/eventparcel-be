// import cron from "node-cron";
// import { WithdrawalService } from "../services/withdrawalServices";
// import { User } from "../models/userModel";
// import { PaymentAndDeliveryModel } from "../models/paymentDeliveryModel";
// import { IHost, INairaPayout } from "../interfaces/modelInterface";

// // Schedule the job to run at 11:59 PM daily "59 23 * * *"
// cron.schedule("*/5 * * * *", async () => {
//     console.log("🚀 Running daily host payout job...");

//     try {
//         // Find all hosts with a positive balance
//         const hosts = await User.find({ role: "host", balance: { $gt: 0 } }) as IHost[];

//         if (hosts.length === 0) {
//             console.log("No hosts with a positive balance for withdrawal.");
//             return;
//         }

//         // Track processed hosts to avoid duplicates
//         const processedHosts = new Set();

//         for (const host of hosts as IHost[]) {
//             if (processedHosts.has(host._id as string)) {
//                 console.log(`⚠️ Skipping duplicate withdrawal for host: ${host.email}`);
//                 continue; // Skip if host has already been processed
//             }

//             // Find the host's payment details to get the recipientCode
//             const paymentDetails = await PaymentAndDeliveryModel.findOne({ user: host._id });
//             if (!paymentDetails) {
//                 console.warn(`⚠️ Host ${host.email} has no payment details. Skipping withdrawal.`);
//                 continue; // Skip this host if no payment details found
//             }

//             if (paymentDetails.nairaAccount && !(paymentDetails.nairaAccount as INairaPayout)?.recipientCode) {
//                 console.warn(`⚠️ Host ${host.email} has no recipientCode. Creating recipient code.`);
//                 // If no recipientCode, and nairaAccount is set up, Create a recipient code
//                 try {
//                     // Generate recipient code
//                     const nairaAccount = paymentDetails.nairaAccount as INairaPayout;
//                     const recipientCode = await WithdrawalService.createRecipient(
//                         nairaAccount.accountName || "",
//                         nairaAccount.accountNumber || "",
//                         nairaAccount.bankCode || "",
//                         host.email
//                     );
                        
//                         // Assign recipientCode to nairaAccount
//                         nairaAccount.recipientCode = recipientCode;
//                         await paymentDetails.save();
//                     console.log(`✅ Created recipient code for ${host.email}: ${recipientCode}`);
//                         } catch (error) {
//                     console.error(`❌ Failed to create recipient code for ${host.email}:`, error);
//                     continue; // Skip this host if recipient code creation fails
//                 }
//                 continue;
//             }

//             const payoutAmount = host.balance ?? 0; // Default to 0 if balance is undefined
//             const recipientCode = (paymentDetails.nairaAccount as INairaPayout)?.recipientCode;

//             if (!recipientCode) {
//                 console.error(`❌ No recipientCode found for ${host.email}. Skipping withdrawal.`);
//                 continue; // Skip this host if recipientCode is missing
//             }

//             try {
//                 // Initiate withdrawal
//                 await WithdrawalService.initiateWithdrawal(
//                     host._id as string,
//                     host.email,
//                     payoutAmount,
//                     "NGN",
//                     recipientCode
//                 );

//                 console.log(`✅ Processed withdrawal for ${host.email}: ₦${payoutAmount}`);

//                 // ✅ **Do NOT reset balance here. Webhook will handle it after successful transfer.**
//                 processedHosts.add(host._id as string); // Mark this host as processed
//             } catch (error) {
//                 console.error(`❌ Failed to process withdrawal for ${host.email}:`, error);
//             }
//         }

//         console.log("🏁 Daily payout job completed.");
//     } catch (error) {
//         console.error("❌ Error running payout job:", error);
//     }
// });

// export default {};



import cron from "node-cron";
import { WithdrawalService } from "../services/withdrawalServices";
import { User } from "../models/userModel";
import { PaymentAndDeliveryModel } from "../models/paymentDeliveryModel";
import { IHost, INairaPayout } from "../interfaces/modelInterface";

// Schedule the job to run every 5 minutes
cron.schedule("59 23 * * *", async () => {
    console.log("🚀 Starting scheduled host payout job...");

    try {
        // Fetch all hosts with a positive balance
        const hosts: IHost[] = await User.find({
            role: "host",
            balance: { $gt: 0 },
        });

        if (!hosts.length) {
            console.log("ℹ️ No eligible hosts found for payout.");
            return;
        }

        const processedHosts = new Set<string>();

        for (const host of hosts) {
            const hostId = (host._id)?.toString();

            if (processedHosts.has(hostId)) {
                console.log(`⚠️ Host already processed: ${host.email}`);
                continue;
            }

            // Retrieve host's payment details
            const paymentDetails = await PaymentAndDeliveryModel.findOne({ user: hostId, nairaAccount: { $exists: true, $ne: null } });

            if (!paymentDetails) {
                console.warn(`⚠️ Missing payment details for host: ${host.email}`);
                continue;
            }

            const nairaAccount = paymentDetails.nairaAccount as INairaPayout;

            // Create recipient code if not already available
            if (nairaAccount && !nairaAccount.recipientCode) {
                console.warn(`⚠️ No recipientCode for ${host.email}. Attempting to create one...`);

                try {
                    const recipientCode = await WithdrawalService.createRecipient(
                        nairaAccount.accountName || "",
                        nairaAccount.accountNumber || "",
                        nairaAccount.bankCode || "",
                        host.email
                    );

                    nairaAccount.recipientCode = recipientCode;
                    await paymentDetails.save();

                    console.log(`✅ Recipient code created for ${host.email}: ${recipientCode}`);
                } catch (err) {
                    console.error(`❌ Failed to create recipient code for ${host.email}:`, err);
                    continue;
                }

                continue; // Will be picked up in next run once recipientCode exists
            }

            const recipientCode = nairaAccount?.recipientCode;

            if (!recipientCode) {
                console.error(`❌ Missing recipientCode for ${host.email}. Skipping payout.`);
                continue;
            }

            const payoutAmount = host.balance ?? 0;

            try {
                await WithdrawalService.initiateWithdrawal(
                    hostId,
                    host.email,
                    payoutAmount,
                    "NGN",
                    recipientCode
                );

                console.log(`💸 Payout initiated for ${host.email}: ₦${payoutAmount}`);
                processedHosts.add(hostId);
            } catch (err) {
                console.error(`❌ Withdrawal failed for ${host.email}:`, err);
            }
        }

        console.log("✅ Host payout job completed successfully.");
    } catch (err) {
        console.error("❌ Unexpected error in payout job:", err);
    }
});

export default {};
