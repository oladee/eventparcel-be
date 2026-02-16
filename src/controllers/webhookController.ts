import { Request, Response } from "express";
import crypto from "crypto";
import { UserService } from "../services/userServices";
import { OrderService } from "../services/orderServices";
import { PackageService } from "../services/eventServices";
import { NotificationService } from "../services/notificationServices";
import PaymentService from "../services/paymentServices";
import { WithdrawalService } from "../services/withdrawalServices";
import { notificationEmail } from "../utils/emailHandler/notificationEmailTemplate";
import { sendMail } from "../utils/emailHandler/email";
import {
  IPaypalEvent,
  IPaystackEvent,
  INormalizedPaymentEvent,
  IHwEvent,
} from "../interfaces/interface";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { IHost, IPackageDeliveryInfo } from "../interfaces/modelInterface";
import { getNextWorkingDelay, hasPlatformHomeDelivery, hasPlatformHomeDelivery2, titleCase, toTitleCase } from "../helpers/helpers";
import { FeeRecordModel } from "../models/feeRecordModel";
import { formatPrice } from "../helpers/helpers";
import { payoutQueue } from '../queues/payoutQueue';
import { buildShippingPayload } from "./orderController";
import { GIGService } from "../services/GIGservice";



// Normalizers
export const normalizePaystackEvent = (
  event: IPaystackEvent
): INormalizedPaymentEvent => ({
  reference: event.data.reference,
  amount: event.data.amount / 100,
  currency: event.data.currency,
  email: event.event === "charge.success"
      ? (event.data as any).customer?.email
      : event.event === "transfer.success"
      ? (event.data as any).recipient?.email
      : undefined,
  provider: "paystack",
  transfer_code: event.data.transfer_code ? event.data.transfer_code : undefined,
  fees: event.event === "charge.success"
      ? ((event.data as any).fees ?? 0) / 100
      : event.event === "transfer.success"
      ? ((event.data as any).fee_charged ?? 0) / 100
      : undefined,
});

const normalizePaypalEvent = (
  event: IPaypalEvent
): INormalizedPaymentEvent => ({
  reference: event.resource.id,
  amount: parseFloat(event.resource?.amount?.value),
  currency: event.resource.amount?.currency_code,
  email: event.resource.payer?.email_address ?? "",
  provider: "paypal",
  fees: event.resource.seller_receivable_breakdown?.paypal_fee
    ? parseFloat(event.resource.seller_receivable_breakdown.paypal_fee.value)
    : undefined,
});

const normalizeHwEvent = (event: IHwEvent): INormalizedPaymentEvent => ({
  reference: event.object.clientPaymentId,
  amount: parseFloat(event.object.amount),
  currency: event.object.currency,
  email: event.object.email || "noreply@eventparcel.com",
  provider: "hyperwallet",
  status: event.object.status,
  transfer_code: event.object.token,
  fees: event.object.fees ? parseFloat(event.object.fees) : undefined,
});

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string;

export const paystackWebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const paystackSignature = req.headers["x-paystack-signature"] as string;
    const rawBody = req?.rawBody || req.body;

    if (!Buffer.isBuffer(rawBody)) {
      return ErrorHandler.validationError(res, "Raw body is not a buffer");
    }

    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    if (hash !== paystackSignature) {
      return ErrorHandler.validationError(res, "Invalid signature");
    }

    const event: IPaystackEvent = JSON.parse(rawBody.toString());
    // const event: IPaystackEvent = req.body

    const existingEvent = await PaymentService.getPaymentByField({
      paymentReference: event.data.reference,
      paymentStatus: "paid",
    });

    if (existingEvent) {
      return sendResponse(res, 200, "Event already processed");
    }

    const normalizedEvent = normalizePaystackEvent(event);

    const eventHandlers: Record<
      string,
      (event: INormalizedPaymentEvent) => Promise<void>
    > = {
      "charge.success": handleChargeSuccess,
      "charge.failed": handleChargeFailed,
      "charge.dispute": handleChargeDispute,
      "charge.refund": handleChargeRefund,
      "transfer.success": handleTransferSuccess,
      "transfer.failed": handleTransferFailed,
    };

    if (eventHandlers[event.event]) {
      await eventHandlers[event.event](normalizedEvent);
    } else {
      console.log(`Unhandled Paystack event type: ${event.event}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Paystack Webhook processing error:", error);
    return ErrorHandler.internalServerError(res, "Internal server error");
  }
};

export const paypalWebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const event: IPaypalEvent = req.body;

    const { event_type, resource } = event;

    if (!event_type || !resource || !resource.id) {
      return ErrorHandler.validationError(
        res,
        "Invalid PayPal webhook payload"
      );
    }

    console.log("Paypal Event: ", event);

    const reference = resource.id;

    const existingTransaction = await PaymentService.getPaymentByField({
      reference,
      status: "successful",
    });

    if (existingTransaction) {
      return sendResponse(res, 200, "Event already processed");
    }

    const normalizedEvent = normalizePaypalEvent(event);

    const eventHandlers: Record<
      string,
      (event: INormalizedPaymentEvent) => Promise<void>
    > = {
      "CHECKOUT.ORDER.APPROVED": handleChargeSuccess,
      "PAYMENT.CAPTURE.COMPLETED": handleChargeSuccess,
      "PAYMENT.CAPTURE.DENIED": handleChargeFailed,
      "PAYMENT.CAPTURE.FAILED": handleChargeFailed,
      "PAYMENT.PAYOUTSBATCH.SUCCESS": handleTransferSuccess,
      "PAYMENT.PAYOUTSBATCH.DENIED": handleTransferFailed,
    };

    if (eventHandlers[event_type]) {
      await eventHandlers[event_type](normalizedEvent);
    } else {
      console.log(`Unhandled PayPal event type: ${event_type}`);
      return sendResponse(res, 200, "Unhandled PayPal event type");
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Paypal Webhook processing error:", error);
    return ErrorHandler.internalServerError(res, "Internal server error");
  }
};

const verifySignature = (req: Request, secret: string) => {
  const signature = req.headers["x-signature"] as string;
  if (!signature) return false;

  const rawBody = (req as any).rawBody; // We must have the raw body!

  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
};

// HyperWallet Webhook
export const hyperwalletWebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const isValid = verifySignature(
      req,
      process.env.HYPERWALLET_WEBHOOK_SECRET!
    );

    if (!isValid) {
      console.warn("❌ Invalid webhook signature.");
      return ErrorHandler.forbidden(res, "Invalid signature");
    }

    const event: IHwEvent = JSON.parse((req as any).rawBody);

    const { type: eventType, object } = event;

    if (!eventType || !object?.clientPaymentId) {
      return ErrorHandler.validationError(
        res,
        "Invalid Hyperwallet webhook payload"
      );
    }

    console.log("Hyperwallet Event:", event);

    const reference = object.clientPaymentId;

    const existingWithdrawal = await WithdrawalService.getWithdrawalByField({
      transferId: reference,
    });
    if (!existingWithdrawal) {
      return ErrorHandler.notFound(res, "Withdrawal not found");
    }

    const normalizedEvent = normalizeHwEvent(event);

    const eventHandlers: Record<
      string,
      (event: INormalizedPaymentEvent) => Promise<void>
    > = {
      "PAYMENT.SUCCEEDED": handleTransferSuccess,
      "PAYMENT.FAILED": handleTransferFailed,
    };

    if (eventHandlers[eventType]) {
      await eventHandlers[eventType](normalizedEvent);
    } else {
      console.log(`Unhandled Hyperwallet event type: ${eventType}`);
      return sendResponse(res, 200, "Unhandled Hyperwallet event type");
    }

    return sendResponse(res, 200, "Webhook verified and processed");
  } catch (error: any) {
    console.error("Hyperwallet Webhook processing error:", error.message);
    return ErrorHandler.internalServerError(res, "Internal server error");
  }
};

// const handleChargeSuccess = async (event: INormalizedPaymentEvent): Promise<void> => {
//   try {
//     console.log("✅ Handling charge success...");

//     const paymentRecord = await PaymentService.getPaymentByField({ paymentReference: event.reference });
//     if (!paymentRecord) {
//       console.warn("⚠️ No payment record found for reference:", event.reference);
//       return;
//     }

//     console.log("Transaction Details: ", event);

//     console.log("💰 Payment record found, processing...");

//     // Update payment status and save
//     paymentRecord.paymentStatus = "paid";
//     paymentRecord.transactionFee = event?.fees;
//     await paymentRecord.save();
//     console.log("✅ Payment status updated to 'paid'");

//     // Fetch Order details
//     const order = await OrderService.getOrderById(paymentRecord.orderId._id.toString());
//     if (!order) {
//       console.warn("⚠️ No order found for payment:", paymentRecord.orderId._id.toString());
//       return;
//     }

//     console.log("📦 Order details found, updating order payment status...");

//     // Update order status to 'paid'
//     order.paymentStatus = "paid";
//     await order.save();
//     console.log("✅ Order status updated to 'paid'");

//     // After confirming payment/order:
//     const packageData = await PackageService.deductPackageQuantities(order.items.map(item => ({
//       ...item,
//       packageId: item.packageId.toString(),
//     })));

//     console.log("📦 Package details found, updating stock quantity...");

//     // Fetch Host details and update balance
//     const host = await UserService.getUserByField({ email: order.eventId.hostEmail }) as IHost;
//     if (!host) {
//       console.warn("⚠️ No host found for event:", order.eventId._id.toString());
//       return;
//     }

//     let platformFee = 0; // 7% for NGN and 8.5% for USD
//     const deliveryFee = order?.homeDeliveryFee || 0;
//     const transactionFee = event?.fees || 0;
//     let hostShare = 0; // 93% for NGN and 91.5% for USD

//     const actualAmount = paymentRecord.amount - (deliveryFee + transactionFee);

//     if (paymentRecord.currency === "NGN") {
//       platformFee = actualAmount * 0.07; // 7% for platformFee
//       hostShare = actualAmount * 0.93; // 93% for the host
//     } else if (paymentRecord.currency === "USD") {
//       platformFee = actualAmount * 0.085; // 8.5% for platformFee
//       hostShare = actualAmount * 0.915; // 91.5% for the host
//     } else {
//       platformFee = 0; // Invalid currency
//       hostShare = 0; // Invalid currency
//     }

//     const balanceField: "balance" | "usdBalance" = paymentRecord.currency === "NGN" ? "balance" : "usdBalance";
//     host[balanceField] += hostShare;

//     await host.save();
//     console.log("✅ Host balance updated:", host[balanceField]);

//     paymentRecord.platformFee = parseFloat(platformFee?.toFixed(2));
//     paymentRecord.hostShare = parseFloat(hostShare?.toFixed(2));
//     await paymentRecord.save();

//     const lowStockPackage = packageData?.find(packageItem => (packageItem?.packageQuantity ?? 0) < 6);
//     if (lowStockPackage) {
//       const notificationBody = `Your event group: ${order.eventGroupId.groupName} of package: ${lowStockPackage?.packageTitle} is running low on stock, remaining ${lowStockPackage?.packageQuantity}. Event Parcel Team`;
//       await sendMail({
//         email: host.email,
//         subject: "Low Stock Quantity",
//         html: notificationEmail(host.email, notificationBody),
//       });
//     }

//     // Email body for guest and host
//     const emailBody = `Payment of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Reference: ${paymentRecord.paymentReference}. Event Parcel Team`;

//     console.log("📧 Sending emails & notifications...");

//     // Send emails & create notification in parallel with error handling
//     const results = await Promise.allSettled([
//       sendMail({
//         email: order.guestEmail,
//         subject: "Payment Successful",
//         html: notificationEmail(order.guestEmail, emailBody),
//       }),
//       sendMail({
//         email: host.email,
//         subject: "Payment Received",
//         html: notificationEmail(host.email, `Your event received a payment of ${paymentRecord.amount} ${paymentRecord.currency}. Reference: ${paymentRecord.paymentReference}`),
//       }),
//       NotificationService.createNotification({
//         user: host._id,
//         userType: "User",
//         email: host.email,
//         subject: "Payment Successful",
//         message: `Your guest ${emailBody}`,
//         date: new Date().toLocaleDateString(),
//         time: new Date().toLocaleTimeString(),
//     })
//   ]);

//   results.forEach((result, index) => {
//     if (result.status === "rejected") {
//       console.error(`❌ Error in Promise[${index}]:`, result.reason);
//     } else {
//       console.log(`✅ Promise[${index}] resolved successfully.`);
//     }
//   });

//   } catch (error) {
//     console.error("❌ Error handling charge success:", error);
//   }
// };

export const handleChargeSuccess = async (
  event: INormalizedPaymentEvent
): Promise<void> => {
  try {
    console.log("✅ Handling charge success...");

    const [paymentRecord] = await Promise.all([
      PaymentService.getPaymentByField({ paymentReference: event.reference }),
    ]);

    if (!paymentRecord) {
      console.warn(
        "⚠️ No payment record found for reference:",
        event.reference
      );
      return;
    }

    console.log("💰 Payment record found, processing...");

    paymentRecord.paymentStatus = "paid";
    paymentRecord.transactionFee = event?.fees;

    const [order] = await Promise.all([
      OrderService.getOrderById(paymentRecord.orderId._id.toString()),
    ]);

    if (!order) {
      console.warn(
        "⚠️ No order found for payment:",
        paymentRecord.orderId._id.toString()
      );
      return;
    }

    order.paymentStatus = "paid";
    // order.orderStatus = order.deliveryType === "homeDelivery" ? "shipped" : "pending";

    const deductPromise = await PackageService.deductPackageQuantities( 
      order.items.map((item) => ({
        ...item,
        quantity: item.quantity ?? null,
        packageId: item.packageId._id.toString(),
      }))
    );

    const packageIds = order.items.map(item =>
      typeof item.packageId === 'object' ? item.packageId._id?.toString() : item.packageId
    ).filter(Boolean);

    const eventPackages = await PackageService.getPackagesDeliveryInfoByIds(packageIds);

    console.log("✅ Package quantity deducted successfully", deductPromise);

    const host = await UserService.getUserByField({
      email: order.eventId.hostEmail,
    }) as IHost;
    if (!host) {
      console.warn("⚠️ No host found for event:", order.eventId._id.toString());
      return;
    }

//     // capture shipment if home delivery is selected and payment is successful (paymentStatus: paid)
// if (hasPlatformHomeDelivery2(order?.deliveryType, order, eventPackages)) {
//   const {
//     eventId,
//     guestFirstName,
//     guestLastName,
//     guestPhoneNumber,
//     shippingAddress,
//     addressLatitude,
//     addressLongitude,
//     city,
//     state,
//     dispatchType,
//     items
//   } = order;

//   const shippingRequest = await buildShippingPayload(eventId, {
//     guestFirstName,
//     guestLastName,
//     guestPhoneNumber,
//     shippingAddress,
//     addressLatitude,
//     addressLongitude,
//     city,
//     state,
//     dispatchType,
//     items,
//   }, "capture");

//   try {
//     const captureShipment = await GIGService.captureShipment(shippingRequest);
//     order.trackingId = captureShipment?.captureData?.waybill || "";
//   } catch (error: any) {
//     const errMsg = error?.message || "";

//     console.error("❌ Unable to capture shipment:", errMsg);

//     if (errMsg.includes("Insufficient Wallet Balance")) {
//       await sendMail({
//         email: "admin@eventparcel.com, ebenezertope4@gmail.com",
//         subject: "GIG Wallet Low: Shipment Capture Failed",
//         html: notificationEmail("Admin", 
//         `
//           <p><strong>Failed to capture shipment due to low wallet balance.</strong></p>
//           <p>Order ID: ${order.orderId}</p>
//           <p>Reference: ${paymentRecord.paymentReference}</p>
//           <p>Event: ${order?.eventId?.eventTitle || "N/A"}</p>
//           <p>Error Message: <code>${errMsg}</code></p>
//         `
//         ),
//       });
      
//       order.reprocess = true;
//       await order.save();

//       console.warn("⚠️ Skipped tracking ID update due to wallet issue");
//     } else {
//       // If it's another error, optionally throw or log
//       throw error;
//     }
//   }
// }

    const deliveryFee = order?.homeDeliveryFee || 0;
    const tax = order?.tax || 0;
    const transactionFee = event?.fees || 0;
    const totalAmount = paymentRecord.amount;
    const actualAmount = paymentRecord.amount - (deliveryFee + tax + transactionFee);

    let platformFee = 0;
    let hostShare = 0;
    const currency = paymentRecord.currency;

    // Get the fees needed for Platform and the Host
    if (currency === "NGN") {
      platformFee = actualAmount * 0.035;  // For NGN Transactions
    } else if (currency === "USD") {
      platformFee = actualAmount * 0.055;  // For USD Transactions
    }

    // platformFee = actualAmount * 0.02;
    hostShare = actualAmount - platformFee;

    // Save to DB
    await FeeRecordModel.create({
      orderId: order._id,
      currency,
      platformFee,
      deliveryFee,
      transactionFee,
      totalAmount,
      actualAmount,
    });

    const balanceField: "balance" | "usdBalance" =
      currency === "NGN" ? "balance" : "usdBalance";
    host[balanceField] += Math.floor(hostShare);

    paymentRecord.platformFee = parseFloat(platformFee.toFixed(2));
    paymentRecord.hostShare = parseFloat(hostShare.toFixed(2));

    // Save all updates in parallel
    await Promise.all([paymentRecord.save(), order.save(), host.save()]);

    // ✅ Notify host if deliveryType is "selfManaged"
if (order.deliveryType === "selfManaged" || order.deliveryType === "homeDelivery") {
  const hostName = `${titleCase(host.firstName)} ${titleCase(host.lastName)}`;
  const guestName = `${titleCase(order.guestFirstName)} ${titleCase(order.guestLastName)}`;

  const packageDetails = order.items
    .map(
      (item) =>
        `${item.packageTitle} × ${item.quantity} = ${formatPrice(
          item.packagePrice * item.quantity,
          paymentRecord.currency as "NGN" | "USD" | undefined
        )}`
    )
    .join("<br/>");

  const selfManagedEmailBody = `
    <p>Dear ${hostName},</p>
    <p>
      This is to notify you that <strong>${guestName}</strong> has made payment for a package.
      Due to their residence falling outside our coverage states, they have specifically requested
      your assistance in managing their order delivery.
    </p>
    <p>
      Event Parcel team is available to assist you where necessary.
      Please contact us via email <a href="mailto:hi@eventparcel.com">hi@eventparcel.com</a>
      or on WhatsApp at <a href="https://wa.me/2349161939774">09161939774</a>.
    </p>

    <h3>Order Details:</h3>
    <p>${packageDetails}</p>

    <p>
      <strong>Address:</strong> ${order.shippingAddress}<br/>
      <strong>City:</strong> ${order.city}<br/>
      <strong>State:</strong> ${order.state}<br/>
      <strong>Phone:</strong> ${order.guestPhoneNumber}<br/>
      <strong>Email:</strong> ${order.guestEmail}
    </p>

    <p>Regards,<br/>Event Parcel</p>
  `;

  // 🧠 Send to host
  try {
    await sendMail({
      email: host.email,
      subject: "Guest Order Requires Your Assistance - Event Parcel",
      html: notificationEmail(hostName, selfManagedEmailBody,true),
    });

    console.log(`📧 Self-managed delivery email sent to host: ${host.email}`);
  } catch (err) {
    console.error("❌ Failed to send self-managed delivery email:", err);
  }


  // 🧠 Send to co-hosts (if any)
  if (order?.eventId?.coHosts?.length) {
    const coHosts = await UserService.getUsersByIds(order.eventId.coHosts);
    const coHostEmails = coHosts.map(c => c.email).filter(Boolean);

    for (const coHostEmail of coHostEmails) {
      await sendMail({
        email: coHostEmail,
        subject: "Self-Managed Delivery Order Notification",
        html: notificationEmail(hostName, selfManagedEmailBody,true),
      });
    }
  }

  console.log("✅ Self-managed order notification sent to host & co-hosts");


}


    // ✅ Enqueue payout job for host via BullMQ
    await payoutQueue.add("instant-payout", {
      hostId: (paymentRecord?.hostId as any)?._id?.toString(),
      hostEmail: host.email,
      hostShare: Math.floor(hostShare), // already rounded earlier
      currency,
      orderId: order._id.toString(),
    }, {
      delay: getNextWorkingDelay(), // 🕒 T+1 logic here
      attempts: 5, // Retry up to 5 times on failure
      backoff: {
      type: "exponential",
      delay: 120 * 1000,           // 1 minute base delay
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });

    const packageData = await deductPromise;

    const lowStockPackage = packageData?.find(
      (pkg) => (pkg?.packageQuantity ?? 0) < 6
    );
    if (lowStockPackage) {
      const notificationBody = `Your event group: ${order.eventGroupId.groupName} of package: ${lowStockPackage.packageTitle} is running low on stock, remaining ${(lowStockPackage.packageQuantity ?? 0) < 0 ? 0 : (lowStockPackage.packageQuantity ?? 0)}.`;
      const hostName = `${titleCase(host.firstName)} ${titleCase(host.lastName)}`;

      await sendMail({
        email: host.email,
        subject: "Low Stock Quantity",
        html: notificationEmail((hostName ?? host.email), notificationBody),
      });
    }

    if (order.deliveryType === "pickUp") {
//       const pickUpEmail1 = `
// <pre style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">
// Dear ${toTitleCase(order.guestFirstName)} ${toTitleCase(order.guestLastName)},

// We received your order and we can't wait to see you grace our occasion on the ${order?.eventId?.date} at ${order?.eventId?.time}.

// Please find below pickup details for your parcel.

// Contact Name: ${toTitleCase(order?.pickUpDetails?.contactName || "")}
// Contact Phone Number: ${order?.pickUpDetails?.contactPhoneNumber}

// PickUp Start Date: ${order?.pickUpDetails?.pickUpStartDate}
// PickUp Start Time: ${order?.pickUpDetails?.pickUpStartTime} ${order?.pickUpDetails?.pickUpStartTimeZone}
// PickUp Address: ${toTitleCase(order?.pickUpDetails?.pickUpAddress || "")}

// Please note that you can only pickup your parcel from the stated pickup date (not before).

// With Love,
// ${toTitleCase(host.firstName)} ${toTitleCase(host.lastName)}

// Event Parcel Limited.
// _____________
// </pre>
// `;

const pickUpEmail = `
<pre style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">

Dear ${toTitleCase(order.guestFirstName)} ${toTitleCase(order.guestLastName)},
We received your order and we can't wait to see you grace our occasion on the ${order?.eventId?.date} at ${order?.eventId?.time}.
Please find below pickup details for your parcel.

Contact Name: ${toTitleCase(order?.pickUpDetails?.contactName || "")}
Contact Phone Number: ${order?.pickUpDetails?.contactPhoneNumber}

PickUp Start Date: ${order?.pickUpDetails?.pickUpStartDate}
PickUp Start Time: ${order?.pickUpDetails?.pickUpStartTime} ${order?.pickUpDetails?.pickUpStartTimeZone}
PickUp Address: ${toTitleCase(order?.pickUpDetails?.pickUpAddress || "")}

Please note that you are responsible for contacting the person listed above and handling the pickup or delivery fees for your parcel. Also, your parcel will only be available for pickup starting from the stated pickup date, not before.

With Love,
${toTitleCase(host.firstName)} ${toTitleCase(host.lastName)}
Event Parcel Limited.
</pre>
`;

      await sendMail({
        email: order?.guestEmail,
        subject: "Pick Up Details",
        html: notificationEmail(((titleCase(`${host.firstName} ${host.lastName}`)) ?? host.email), pickUpEmail, true),
      });

}

// ✅ Prepare package details for emails
const packageDetails = order.items
  .map(
    (item) =>
      `${item.packageTitle} × ${item.quantity} = ${formatPrice(
        item.packagePrice * item.quantity,
        paymentRecord.currency as "NGN" | "USD"
      )}`
  )
  .join("<br/>");

// ✅ Prepare admin email body
const superAdmins = await UserService.getUsers({
  role: {"$in": ["superAdmin", "admin"]},
  status: "active",
});

const adminEmailBody = `
<p>Dear Team,</p>
<p>
This is to notify you that <strong>${order.guestFirstName} ${order.guestLastName}</strong> has made payments for a package under the Event <strong>${order?.eventId?.eventTitle || "N/A"}</strong>.
</p>
<h4>Order Details:</h4>
<p>${packageDetails}</p>
<p>
<strong>Guest Address:</strong> ${order.shippingAddress || "N/A"}<br/>
<strong>Guest City:</strong> ${order.city || "N/A"}<br/>
<strong>Guest State:</strong> ${order.state || "N/A"}<br/>
<strong>Guest Phone Number:</strong> ${order.guestPhoneNumber}<br/>
<strong>Guest Email Address:</strong> ${order.guestEmail || "N/A"}<br/>
<strong>Delivery Type:</strong> ${order.deliveryType || "N/A"}<br/>
<strong>Host Name:</strong> ${host.firstName} ${host.lastName}<br/>
<strong>Event Date/Time:</strong> ${order?.eventId?.date || "N/A"} / ${order?.eventId?.time || "N/A"}<br/>
<strong>PickUp Start Date/Time:</strong> ${
  order.pickUpDetails?.pickUpStartDate
    ? `${order.pickUpDetails.pickUpStartDate} ${order.pickUpDetails.pickUpStartTime || ""}`
    : "N/A"
}
</p>
<p>Regards,<br/>Event Parcel</p>
`;


    // Email & Notification
    const now = new Date();
    const emailBody = `Payment of ${formatPrice(paymentRecord.amount, currency as "NGN" | "USD" | undefined)} ${currency} was successful. Reference: ${paymentRecord.paymentReference}.`;

    const [guestMail, hostMail, hostNotification, adminEmails] = await Promise.allSettled([
      // Guest email
      sendMail({
        email: order.guestEmail,
        subject: "Payment Successful",
        html: notificationEmail((titleCase(`${order.guestFirstName} ${order.guestLastName}`) ?? order.guestEmail), emailBody),
      }),

      // Host email
      sendMail({
        email: host.email,
        subject: "Payment Received",
        html: notificationEmail(
          ((titleCase(`${host.firstName} ${host.lastName}`)) ?? host.email),
          `Your event received a payment of ${formatPrice(paymentRecord.amount, currency as "NGN" | "USD" | undefined)} ${currency}. Reference: ${paymentRecord.paymentReference}`
        ,true),
      }),

      // Host in-app notification
      NotificationService.createNotification({
        user: host._id,
        userType: "User",
        email: host.email,
        subject: "Payment Successful",
        message: `Your guest ${emailBody}`,
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
      }),

    // Admin emails to all active super admins
    ...superAdmins.map((admin) =>
    sendMail({
      email: admin.email,
      subject: "Payment Notification",
      html: notificationEmail("Team", adminEmailBody),
    })
  ),
    ]);

    [guestMail, hostMail, hostNotification, adminEmails].forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`❌ Error in Promise[${index}]:`, result.reason);
      } else {
        console.log(`✅ Promise[${index}] resolved successfully.`);
      }
    });
  } catch (error) {
    console.error("❌ Error handling charge success:", error);
  }
};




const handleChargeFailed = async (
  event: INormalizedPaymentEvent
): Promise<void> => {
  try {
    console.log("⚠️ Handling charge failure...");

    const paymentRecord = await PaymentService.getPaymentByField({
      paymentReference: event.reference,
    });
    if (!paymentRecord) {
      console.warn(
        "⚠️ No payment record found for reference:",
        event.reference
      );
      return;
    }

    console.log("💰 Payment record found, marking as failed...");

    // Update payment status and save
    paymentRecord.paymentStatus = "failed";
    await paymentRecord.save();
    console.log("✅ Payment status updated to 'failed'");

    // Fetch Order details
    const order = await OrderService.getOrderById(
      paymentRecord.orderId._id.toString()
    );
    if (!order) {
      console.warn(
        "⚠️ No order found for payment:",
        paymentRecord.orderId._id.toString()
      );
      return;
    }

    // Fetch Host details
    const host = await UserService.getUserByField({
      email: order.eventId.hostEmail,
    });
    if (!host) {
      console.warn("⚠️ No host found for event:", order.eventId._id.toString());
      return;
    }
    const hostName = `${titleCase(host.firstName)} ${titleCase(host.lastName)}`;

    console.log("📧 Sending failure emails & notifications...");

    const emailBodyGuest = `Your payment of ${formatPrice(paymentRecord.amount, paymentRecord.currency as "NGN" | "USD" | undefined)} ${paymentRecord.currency} has failed. Please try again.`;
    const emailBodyHost = `A guest attempted a payment of ${formatPrice(paymentRecord.amount, paymentRecord.currency as "NGN" | "USD" | undefined)} ${paymentRecord.currency}, but it failed.`;

    // Send emails & create notification in parallel
    const results = await Promise.allSettled([
      sendMail({
        email: order.guestEmail,
        subject: "Payment Failed",
        html: notificationEmail(((titleCase(`${order.guestFirstName} ${order.guestLastName}`)) ?? order.guestEmail), emailBodyGuest),
      }),
      sendMail({
        email: host.email,
        subject: "Payment Attempt Failed",
        html: notificationEmail((hostName ?? host.email), emailBodyHost),
      }),
      NotificationService.createNotification({
        user: host._id,
        userType: "User",
        email: host.email,
        subject: "Payment Failed",
        message: `A guest attempted to pay ${formatPrice(paymentRecord.amount, paymentRecord.currency as "NGN" | "USD" | undefined)} ${paymentRecord.currency}, but the transaction failed.`,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
      }),
    ]);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`❌ Error in Promise[${index}]:`, result.reason);
      } else {
        console.log(`✅ Promise[${index}] resolved successfully.`);
      }
    });
  } catch (error) {
    console.error("❌ Error handling charge failure:", error);
  }
};

const handleChargeDispute = async (
  event: INormalizedPaymentEvent
): Promise<void> => {
  try {
    console.log("⚠️ Handling charge dispute...");

    const paymentRecord = await PaymentService.getPaymentByField({
      paymentReference: event.reference,
    });
    if (!paymentRecord) {
      console.warn(
        "⚠️ No payment record found for reference:",
        event.reference
      );
      return;
    }

    console.log("💰 Payment record found, marking as dispute...");

    // Update payment status and save
    paymentRecord.paymentStatus = "dispute";
    await paymentRecord.save();
    console.log("✅ Payment status updated to 'dispute'");

    // Fetch Order details
    const order = await OrderService.getOrderById(
      paymentRecord.orderId._id.toString()
    );
    if (!order) {
      console.warn(
        "⚠️ No order found for payment:",
        paymentRecord.orderId._id.toString()
      );
      return;
    }

    // Fetch Host details
    const host = await UserService.getUserByField({
      email: order.eventId.hostEmail,
    });
    if (!host) {
      console.warn("⚠️ No host found for event:", order.eventId._id.toString());
      return;
    }

    console.log("📧 Sending dispute emails & notifications...");

    const emailBodyGuest = `A dispute has been raised on your payment of ${formatPrice(paymentRecord.amount, paymentRecord.currency as "NGN" | "USD" | undefined)} ${paymentRecord.currency}. Our team is reviewing the issue.`;
    const emailBodyHost = `A dispute has been raised on a payment of ${formatPrice(paymentRecord.amount, paymentRecord.currency as "NGN" | "USD" | undefined)} ${paymentRecord.currency} for your event. Please check your dashboard for updates.`;

    // Send emails & create notification in parallel
    const results = await Promise.allSettled([
      sendMail({
        email: order.guestEmail,
        subject: "Charge Disputed",
        html: notificationEmail(((titleCase(`${order.guestFirstName} ${order.guestLastName}`)) ?? order.guestEmail), emailBodyGuest),
      }),
      sendMail({
        email: host.email,
        subject: "Charge Dispute Alert",
        html: notificationEmail(((titleCase(`${host.firstName} ${host.lastName}`)) ?? host.email), emailBodyHost),
      }),
      NotificationService.createNotification({
        user: host._id,
        userType: "User",
        email: host.email,
        subject: "Charge Disputed",
        message: `A charge dispute has been raised for a payment of ${formatPrice(paymentRecord.amount, paymentRecord.currency as "NGN" | "USD" | undefined)} ${paymentRecord.currency} for your event.`,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
      }),
    ]);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`❌ Error in Promise[${index}]:`, result.reason);
      } else {
        console.log(`✅ Promise[${index}] resolved successfully.`);
      }
    });
  } catch (error) {
    console.error("❌ Error handling charge dispute:", error);
  }
};

const handleChargeRefund = async (
  event: INormalizedPaymentEvent
): Promise<void> => {
  try {
    console.log("🔄 Handling charge refund...");

    const paymentRecord = await PaymentService.getPaymentByField({
      paymentReference: event.reference,
    });
    if (!paymentRecord) {
      console.warn(
        "⚠️ No payment record found for reference:",
        event.reference
      );
      return;
    }

    console.log("💰 Payment record found, marking as refunded...");

    // Update payment status and save
    paymentRecord.paymentStatus = "refund";
    await paymentRecord.save();
    console.log("✅ Payment status updated to 'refund'");

    // Fetch Order details
    const order = await OrderService.getOrderById(
      paymentRecord.orderId._id.toString()
    );
    if (!order) {
      console.warn(
        "⚠️ No order found for payment:",
        paymentRecord.orderId._id.toString()
      );
      return;
    }

    // Fetch Host details
    const host = await UserService.getUserByField({
      email: order.eventId.hostEmail,
    });
    if (!host) {
      console.warn("⚠️ No host found for event:", order.eventId._id.toString());
      return;
    }

    console.log("📧 Sending refund emails & notifications...");

    const emailBodyGuest = `Your payment of ${formatPrice(paymentRecord.amount, paymentRecord.currency as "NGN" | "USD" | undefined)} ${paymentRecord.currency} has been successfully refunded.`;
    const emailBodyHost = `A refund of ${formatPrice(paymentRecord.amount, paymentRecord.currency as "NGN" | "USD" | undefined)} ${paymentRecord.currency} has been processed for your event.`;

    // Send emails & create notification in parallel
    const results = await Promise.allSettled([
      sendMail({
        email: order.guestEmail,
        subject: "Refund Processed",
        html: notificationEmail(((titleCase(`${order.guestFirstName} ${order.guestLastName}`)) ?? order.guestEmail), emailBodyGuest),
      }),
      sendMail({
        email: host.email,
        subject: "Refund Issued",
        html: notificationEmail(((titleCase(`${host.firstName} ${host.lastName}`)) ?? host.email), emailBodyHost),
      }),
      NotificationService.createNotification({
        user: host._id,
        userType: "User",
        email: host.email,
        subject: "Refund Processed",
        message: `A refund of ${formatPrice(paymentRecord.amount, paymentRecord.currency as "NGN" | "USD" | undefined)} ${paymentRecord.currency} has been issued for a payment made for your event.`,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
      }),
    ]);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`❌ Error in Promise[${index}]:`, result.reason);
      } else {
        console.log(`✅ Promise[${index}] resolved successfully.`);
      }
    });
  } catch (error) {
    console.error("❌ Error handling charge refund:", error);
  }
};

const handleTransferSuccess = async (
  event: INormalizedPaymentEvent
): Promise<void> => {
  try {
    console.log("✅ Handling transfer success...");

    const withdrawal = await WithdrawalService.getWithdrawalByField({
      transferId: event.transfer_code,
    });
    if (!withdrawal) {
      console.warn(
        "⚠️ No withdrawal record found for transfer ID:",
        event.transfer_code
      );
      return;
    }

    console.log("💰 Withdrawal record found, marking as completed...");

    // Update withdrawal status and save
    withdrawal.withdrawalStatus = "completed";
    await withdrawal.save();
    console.log("✅ Withdrawal status updated to 'completed'");

    // Fetch event host details
    const host = (await UserService.getUserByField({
      email: withdrawal.email,
    })) as IHost;
    if (!host) {
      console.warn("⚠️ No host found for withdrawal:", withdrawal.email);
      return;
    }

    const hostName = titleCase(`${host.firstName} ${host.lastName}`);

    // Deduct amount from host balance
    const balanceField: "balance" | "usdBalance" =
      withdrawal.currency === "NGN" ? "balance" : "usdBalance";
    host[balanceField] -= withdrawal.amount;

    await host.save();
    console.log("✅ Host balance updated:", host[balanceField]);

    console.log("📧 Sending transfer success email & notification...");

    const emailBody = `Your transfer of ${formatPrice(withdrawal.amount, withdrawal.currency as "NGN" | "USD" | undefined)} ${withdrawal.currency} to your bank account was successful.`;

    // Send email & create notification in parallel
    const results = await Promise.allSettled([
      sendMail({
        email: withdrawal.email,
        subject: "Transfer Successful",
        html: notificationEmail((hostName ?? withdrawal.email), emailBody),
      }),
      NotificationService.createNotification({
        user: withdrawal.userId,
        userType: "User",
        email: withdrawal.email,
        subject: "Transfer Successful",
        message: `Your withdrawal of ${formatPrice(withdrawal.amount, withdrawal.currency as "NGN" | "USD" | undefined)} ${withdrawal.currency} has been successfully processed.`,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
      }),
    ]);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`❌ Error in Promise[${index}]:`, result.reason);
      } else {
        console.log(`✅ Promise[${index}] resolved successfully.`);
      }
    });
  } catch (error) {
    console.error("❌ Error handling transfer success:", error);
  }
};

const handleTransferFailed = async (
  event: INormalizedPaymentEvent
): Promise<void> => {
  try {
    console.log("❌ Handling transfer failure...");

    const withdrawal = await WithdrawalService.getWithdrawalByField({
      transferId: event.transfer_code,
    });
    if (!withdrawal) {
      console.warn(
        "⚠️ No withdrawal record found for transfer ID:",
        event.transfer_code
      );
      return;
    }

    console.log("💰 Withdrawal record found, marking as failed...");

    // Update withdrawal status and save
    withdrawal.withdrawalStatus = "failed";
    await withdrawal.save();
    console.log("❌ Withdrawal status updated to 'failed'");

    // Fetch event host details
    const host = (await UserService.getUserByField({
      email: withdrawal.email,
    })) as IHost;
    if (!host) {
      console.warn("⚠️ No host found for withdrawal:", withdrawal.email);
      return;
    }

    const hostName = titleCase(`${host.firstName} ${host.lastName}`);

    console.log("📧 Sending transfer failure email & notification...");

    const emailBody = `Your transfer of ${formatPrice(withdrawal.amount, withdrawal.currency as "NGN" | "USD" | undefined)} ${withdrawal.currency} has failed.`;

    // Send email & create notification in parallel
    const results = await Promise.allSettled([
      sendMail({
        email: withdrawal.email,
        subject: "Transfer Failed",
        html: notificationEmail((hostName ?? withdrawal.email), emailBody),
      }),
      NotificationService.createNotification({
        user: withdrawal.userId,
        userType: "User",
        email: withdrawal.email,
        subject: "Transfer Failed",
        message: `Your withdrawal of ${formatPrice(withdrawal.amount, withdrawal.currency as "NGN" | "USD" | undefined)} ${withdrawal.currency} has failed. Please try again later.`,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
      }),
    ]);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`❌ Error in Promise[${index}]:`, result.reason);
      } else {
        console.log(`✅ Promise[${index}] resolved successfully.`);
      }
    });
  } catch (error) {
    console.error("❌ Error handling transfer failure:", error);
  }
};
