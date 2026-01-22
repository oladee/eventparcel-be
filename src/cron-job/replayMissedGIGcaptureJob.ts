import cron from "node-cron";
import { OrderService } from "../services/orderServices";
import { GIGService } from "../services/GIGservice";
import { buildShippingPayload } from "../controllers/orderController";
import { sendMail } from "../utils/emailHandler/email";
import { notificationEmail } from "../utils/emailHandler/notificationEmailTemplate";
import { hasPlatformHomeDelivery2 } from "../helpers/helpers";
import { PackageService } from "../services/eventServices";

cron.schedule("0 0 * * *", async () => {
  console.log("🚀 Starting scheduled Missed GIG Capture jobs...");

  try {
    const reprocessOrders = await OrderService.getAllOrders({
      reprocess: true,
      paymentStatus: "paid",
    });

    console.log(`🔍 Found ${reprocessOrders.length} orders to reprocess`);

    let successCount = 0;
    let failedCount = 0;

    for (const order of reprocessOrders) {
      try {
        const packageIds = (order.items || [])
          .map(item =>
            typeof item.packageId === "object"
              ? item.packageId?._id?.toString()
              : item.packageId
          )
          .filter(Boolean);

        const eventPackages = await PackageService.getPackagesDeliveryInfoByIds(packageIds);

        if (!hasPlatformHomeDelivery2(order?.deliveryType, order, eventPackages)) {
          console.log(`⏩ Skipping Order ${order.orderId} — Not home delivery`);
          continue;
        }

        const shippingRequest = await buildShippingPayload(
          order.eventId,
          {
            guestFirstName: order.guestFirstName,
            guestLastName: order.guestLastName,
            guestPhoneNumber: order.guestPhoneNumber,
            shippingAddress: order.shippingAddress,
            addressLatitude: order.addressLatitude,
            addressLongitude: order.addressLongitude,
            city: order.city,
            state: order.state,
            dispatchType: order.dispatchType,
            items: order.items,
          },
          "capture"
        );

        try {
          const captureShipment = await GIGService.captureShipment(shippingRequest);
          order.trackingId = captureShipment?.captureData?.waybill || "";
          order.reprocess = false;
          successCount++;
        } catch (error: any) {
          const errMsg = error?.message || "";
          console.error(`❌ Error capturing shipment for Order ${order.orderId}: ${errMsg}`);

          if (errMsg.includes("Insufficient Wallet Balance")) {
            await sendMail({
              email: "admin@eventparcel.com, ebenezertope4@gmail.com",
              subject: "GIG Wallet Low: Shipment Capture Failed",
              html: notificationEmail(
                "Admin",
                `
                  <p><strong>Failed to capture shipment due to low wallet balance.</strong></p>
                  <p>Order ID: ${order.orderId}</p>
                  <p>Event: ${order?.eventId?.eventTitle || "N/A"}</p>
                  <p>Error Message: <code>${errMsg}</code></p>
                `
              ),
            });

            order.reprocess = true;
          } else {
            order.reprocess = true;
            failedCount++;
          }
        }

        await order.save();
      } catch (err) {
        console.error(`🔥 Unexpected error for Order ${order.orderId}:`, err);
        failedCount++;
      }
    }

    console.log(`📊 Job complete — Processed: ${reprocessOrders.length}, Successful: ${successCount}, Failed: ${failedCount}`);
  } catch (error) {
    console.error("🔥 Unexpected error:", error);
  }
});

export default {};
