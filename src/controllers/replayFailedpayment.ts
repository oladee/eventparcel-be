// import { PaymentModel } from "src/models/paymentModel";
// import { normalizePaystackEvent, handleChargeSuccess } from "./webhookController";
// import axios from "axios";



// const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

// const from = new Date("2025-07-30T00:00:00"); // From Wednesday
// const now = new Date();

// async function verifyWithPaystack(reference: string) {
//   try {
//     const res = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
//       headers: {
//         Authorization: `Bearer ${PAYSTACK_SECRET}`
//       }
//     });

//     const { status, data } = res.data;
//     return status && data.status === "success" ? data : null;
//   } catch (err: any) {
//     console.error(`❌ Error verifying ${reference}:`, err.response?.data || err.message);
//     return null;
//   }
// }


// async function replayMissedPayments() {

//   const failedPayments = await PaymentModel.find({
//     paymentStatus: "pending",
//     createdAt: { $gte: from, $lte: now },
//     paymentReference: { $exists: true }
//   });

//   console.log(`🔍 Found ${failedPayments.length} payments to verify`);

//   for (const payment of failedPayments) {
//     const { paymentReference } = payment;

//     const verified = await verifyWithPaystack(paymentReference);

//     if (!verified) {
//       console.warn(`⚠️ Skipping ${paymentReference} — not successful`);
//       continue;
//     }

//     const fakeWebhookEvent = {
//       event: "charge.success",
//       data: verified
//     };

//     const normalizedEvent = normalizePaystackEvent(fakeWebhookEvent);

//     console.log(`🔁 Reprocessing: ${paymentReference}`);
//     try {
//       await handleChargeSuccess(normalizedEvent);
//       console.log(`✅ Success: ${paymentReference}`);
//     } catch (err: any) {
//       console.error(`❌ Error processing ${paymentReference}:`, err.message);
//     }
//   }

// }

// replayMissedPayments().catch(err => {
//   console.error("🔥 Script crashed:", err);
//   process.exit(1);
// });




// controllers/replayPaymentsController.ts

import { Request, Response } from "express";
import { PaymentModel } from "../models/paymentModel";
import { normalizePaystackEvent, handleChargeSuccess } from "./webhookController";
import axios from "axios";
import { IPayment } from "../interfaces/modelInterface";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const from = new Date("2025-10-13T00:00:00");
const now = new Date();

async function verifyWithPaystack(reference: string) {
  try {
    const res = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`
      }
    });

    const { status, data } = res.data;
    console.log("Payment details:", JSON.stringify(res.data, null, 2));
    return status && data.status === "success" ? data : null;
  } catch (err: any) {
    console.error(`❌ Error verifying ${reference}:`, err.response?.data || err.message);
    return null;
  }
}

export const replayMissedPayments = async (req: Request, res: Response) => {
  try {
    const failedPayments = await PaymentModel.find({
      paymentStatus: "pending",
      createdAt: { $gte: from, $lte: now },
      paymentReference: { $exists: true }
    });

    console.log(`🔍 Found ${failedPayments.length} payments to verify`);

    let successCount = 0;
    let failedCount = 0;

    for (const payment of failedPayments) {
      const { paymentReference } = payment;

      const verified = await verifyWithPaystack(paymentReference);
      console.log("Each Payment details: ", verified)

      if (!verified) {
        console.warn(`⚠️ Skipping ${paymentReference} — not successful`);
        failedCount++;
        continue;
      }

      const fakeWebhookEvent = {
        event: "charge.success",
        data: verified
      };

      const normalizedEvent = normalizePaystackEvent(fakeWebhookEvent);

      console.log(`🔁 Reprocessing: ${paymentReference}`);
      try {
        await handleChargeSuccess(normalizedEvent);
        console.log(`✅ Success: ${paymentReference}`);
        successCount++;
      } catch (err: any) {
        console.error(`❌ Error processing ${paymentReference}:`, err.message);
        failedCount++;
      }
    }

    res.status(200).json({
      message: `Reprocessed ${failedPayments.length} payments`,
      successful: successCount,
      failed: failedCount
    });
  } catch (error: any) {
    console.error("🔥 Unexpected error:", error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
};



export const replaySinglePayment = async (req: Request, res: Response) => {
  try {
    const { paymentReference } = req.body;

    // ✅ Validate: must start with REF- followed by digits only
    const referencePattern = /^REF-\d+$/;
    if (!referencePattern.test(paymentReference)) {
      return res.status(400).json({
        error: "Invalid paymentReference format. Expected format: REF- followed by numbers (e.g., REF-173028282828).",
      });
    }

    // ✅ Find the payment record
    const payment = await PaymentModel.findOne({ paymentReference });
    if (!payment) {
      return res.status(404).json({ error: "Payment not found." });
    }

    if (payment.paymentStatus === "paid") {
      return res.status(400).json({ error: "Payment already processed and marked 'paid'! " })
    }

    console.log(`🔍 Verifying paymentReference: ${paymentReference}`);

    // ✅ Verify with Paystack
    const verified = await verifyWithPaystack(paymentReference);
    if (!verified) {
      return res.status(400).json({ error: "Payment verification failed or not successful on Paystack." });
    }

    const fakeWebhookEvent = {
      event: "charge.success",
      data: verified,
    };

    const normalizedEvent = normalizePaystackEvent(fakeWebhookEvent);

    // ✅ Reprocess successful payment
    try {
      await handleChargeSuccess(normalizedEvent);
      console.log(`✅ Payment successfully reprocessed: ${paymentReference}`);
      return res.status(200).json({
        message: "Payment successfully reprocessed.",
        paymentReference,
      });
    } catch (err: any) {
      console.error(`❌ Error processing payment: ${err.message}`);
      return res.status(500).json({ error: "Error while reprocessing payment." });
    }

  } catch (error: any) {
    console.error("🔥 Unexpected error:", error.message);
    return res.status(500).json({ error: "Something went wrong while replaying payment." });
  }
};




import { OrderService } from "../services/orderServices";
import { GIGService } from "../services/GIGservice";
import { buildShippingPayload } from "./orderController";
import { sendMail } from "../utils/emailHandler/email";
import { notificationEmail } from "../utils/emailHandler/notificationEmailTemplate";
import { PackageService } from "../services/eventServices";

export const reprocessShipment = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    const order = await OrderService.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.trackingId) {
      return res.status(409).json({ message: "Order already has a tracking ID" });
    }

    const eventPackages = await PackageService.getPackagesDeliveryInfoByIds(
      order.items.map(item =>
        typeof item.packageId === "object"
          ? item.packageId._id?.toString()
          : item.packageId
      )
    );

    const shippingPayload = await buildShippingPayload(order.eventId, {
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
    }, "capture");

    let shipment;
    try {
      shipment = await GIGService.captureShipment(shippingPayload);
    } catch (error: any) {
      const errMsg = error?.message || "Unknown error";
      console.error("❌ Shipment failed:", errMsg);

      if (errMsg.includes("Insufficient Wallet Balance")) {
        await sendMail({
          email: "admin@eventparcel.com, ebenezertope4@gmail.com",
          subject: "GIG Wallet Low: Manual Reprocessing Failed",
          html: notificationEmail("Admin", `
            <p><strong>Manual reprocess failed due to insufficient wallet balance.</strong></p>
            <p>Order ID: ${order._id}</p>
            <p>Error: ${errMsg}</p>
          `),
        });

        return res.status(503).json({ message: "Shipment failed: Insufficient Wallet Balance" });
      }

      return res.status(500).json({ message: "Shipment failed", error: errMsg });
    }

    order.trackingId = shipment?.captureData?.waybill || "";
    order.reprocess = false; // Clear the flag
    await order.save();

    return res.status(200).json({ message: "Shipment reprocessed successfully", trackingId: order.trackingId });
  } catch (err: any) {
    console.error("❌ Reprocess shipment error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};
