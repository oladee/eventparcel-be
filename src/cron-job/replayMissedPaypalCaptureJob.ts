import dotenv from "dotenv";
import mongoose from "mongoose";
import * as paypal from "@paypal/checkout-server-sdk";
import { connectDB } from "../config/dbConfig";
import { paypalClient } from "../config/paypalConfig";
import { PaymentModel } from "../models/paymentModel";
import PaymentService from "../services/paymentServices";
import { handleChargeSuccess } from "../controllers/webhookController";
import { IPaypalCaptureResponse } from "../interfaces/interface";

dotenv.config();

type ScriptArgs = {
  from?: Date;
  to?: Date;
  limit: number;
  reference?: string;
  dryRun: boolean;
};

const SUCCESSFUL_ORDER_STATUSES = new Set(["APPROVED", "COMPLETED"]);

const parseDateArg = (raw?: string): Date | undefined => {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${raw}`);
  }
  return parsed;
};

const parseArgs = (): ScriptArgs => {
  const args = process.argv.slice(2);
  const parsed: ScriptArgs = {
    limit: 100,
    dryRun: false,
  };

  for (const arg of args) {
    const [key, value] = arg.split("=");

    if (key === "--from") parsed.from = parseDateArg(value);
    if (key === "--to") parsed.to = parseDateArg(value);
    if (key === "--limit" && value) parsed.limit = Math.max(1, Number(value));
    if (key === "--reference") parsed.reference = value;
    if (key === "--dry-run") parsed.dryRun = true;
  }

  if (!Number.isFinite(parsed.limit)) {
    throw new Error("Invalid --limit value");
  }

  return parsed;
};

const getPaypalOrder = async (orderId: string): Promise<IPaypalCaptureResponse> => {
  const request = new paypal.orders.OrdersGetRequest(orderId);
  const response = (await paypalClient.execute(request)) as {
    result: IPaypalCaptureResponse;
  };

  return response.result;
};

const getFirstCaptureStatus = (order: IPaypalCaptureResponse): string | undefined =>
  order.purchase_units?.flatMap((unit) => unit.payments?.captures ?? [])[0]
    ?.status;

const run = async () => {
  const { from, to, limit, reference, dryRun } = parseArgs();

  await connectDB();

  const query: Record<string, any> = {
    currency: "USD",
    paymentStatus: "pending",
    paymentReference: {
      $exists: true,
      $nin: [null, ""],
      $not: /^REF-/,
    },
  };

  if (reference) {
    query.paymentReference = reference;
  }

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;
  }

  const pendingPayments = await PaymentModel.find(query)
    .sort({ createdAt: 1 })
    .limit(limit)
    .select("paymentReference paymentStatus createdAt");

  console.log(
    `🔍 Found ${pendingPayments.length} PayPal pending payments to check (dryRun=${dryRun})`
  );

  let inspected = 0;
  let eligible = 0;
  let captured = 0;
  let skipped = 0;
  let failed = 0;

  for (const payment of pendingPayments) {
    inspected += 1;
    const paymentReference = payment.paymentReference;

    if (!paymentReference) {
      skipped += 1;
      continue;
    }

    try {
      const order = await getPaypalOrder(paymentReference);
      const orderStatus = order.status ?? "UNKNOWN";
      const captureStatus = getFirstCaptureStatus(order) ?? "NONE";

      if (!SUCCESSFUL_ORDER_STATUSES.has(orderStatus)) {
        skipped += 1;
        console.log(
          `⏭️ Skipped ${paymentReference}: order status is ${orderStatus}`
        );
        continue;
      }

      eligible += 1;
      console.log(
        `✅ Eligible ${paymentReference}: order=${orderStatus}, capture=${captureStatus}`
      );

      if (dryRun) {
        continue;
      }

      const capturedEvent = await PaymentService.capturePaypalOrder(paymentReference);
      await handleChargeSuccess(capturedEvent);
      captured += 1;

      console.log(`🎉 Processed ${paymentReference} successfully`);
    } catch (error: any) {
      failed += 1;
      console.error(
        `❌ Failed ${paymentReference}:`,
        error?.message || "Unknown error"
      );
    }
  }

  console.log("\n📊 Replay summary");
  console.log(`Inspected: ${inspected}`);
  console.log(`Eligible (approved/completed): ${eligible}`);
  console.log(`Captured + applied: ${captured}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
};

run()
  .catch((error) => {
    console.error("🔥 Script crashed:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
