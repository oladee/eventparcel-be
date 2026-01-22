import cron from "node-cron";
import { WithdrawalService } from "../services/withdrawalServices";
import { User } from "../models/userModel";
import { PaymentAndDeliveryModel } from "../models/paymentDeliveryModel";
import { IHost } from "../interfaces/modelInterface";

// Schedule the job to run at 11:59 PM daily
cron.schedule("59 23 * * *", async () => {
    console.log("🚀 Running daily host payout job...");
  
    try {
      const hosts = await User.find({ role: "host", usdBalance: { $gt: 0 } }) as IHost[];
  
      if (hosts.length === 0) {
        console.log("No hosts with a positive balance for withdrawal.");
        return;
      }
  
      const processedHosts = new Set();
  
      for (const host of hosts as IHost[]) {
        if (processedHosts.has(host._id?.toString())) {
          console.log(`⚠️ Skipping duplicate withdrawal for host: ${host.email}`);
          continue;
        }
  
        const paymentDetails = await PaymentAndDeliveryModel.findOne({ user: host._id });
  
        if (
            !paymentDetails ||
            !(paymentDetails.dollarAccount as any)?.routingNumber ||
            !(paymentDetails.dollarAccount as any)?.usAccountNumber
          ) {
            console.warn(`⚠️ Host ${host.email} has incomplete USD bank details. Skipping.`);
            continue;
          }          
  
        const payoutAmount = host.usdBalance ?? 0;
  
        try {
          const result = await WithdrawalService.initiateHyperwalletWithdrawal(
            {
              _id: host._id?.toString(),
              email: host.email,
              firstName: host.firstName,
              lastName: host.lastName,
              // Fallback/default values since they're not collected yet
              address: "123 Main St",
              city: "Los Angeles",
              state: "CA",
              country: "US",
              postalCode: "90001",
              dob: "1990-01-01",
            },
            payoutAmount,
            {
                bankCode: (paymentDetails.dollarAccount as any).routingNumber,
                accountNumber: (paymentDetails.dollarAccount as any).usAccountNumber,
            }
          );
  
          console.log(`✅ Processed HW withdrawal for ${host.email}: $${payoutAmount}`);
          processedHosts.add(host._id?.toString());
  
          // No balance reset here — wait for webhook to confirm success.
        } catch (error) {
          console.error(`❌ Failed to process HW withdrawal for ${host.email}:`, error);
        }
      }
  
      console.log("🏁 Daily payout job completed.");
    } catch (error) {
      console.error("❌ Error running payout job:", error);
    }
  });
  
export default {};
