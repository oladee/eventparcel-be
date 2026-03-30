import dotenv from "dotenv";
import axios from "axios";
import { getPayPalAccessToken } from "../config/paypalConfig";

dotenv.config();

const PAYPAL_API_BASE = process.env.NODE_ENV === "production"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

type ScriptArgs = {
  orderIds: string[];
  dryRun: boolean;
};

const normalizeOrderIds = (value?: string): string[] => {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseArgs = (): ScriptArgs => {
  const args = process.argv.slice(2);
  const parsed: ScriptArgs = {
    orderIds: [],
    dryRun: false,
  };

  for (const arg of args) {
    const [key, value] = arg.split("=");

    if (key === "--order-id" && value) {
      parsed.orderIds.push(...normalizeOrderIds(value));
      continue;
    }

    if (key === "--order-ids" && value) {
      parsed.orderIds.push(...normalizeOrderIds(value));
      continue;
    }

    if (key === "--dry-run") parsed.dryRun = true;
  }

  parsed.orderIds = [...new Set(parsed.orderIds)];

  if (parsed.orderIds.length === 0) {
    throw new Error(
      "No order IDs supplied. Use --order-id=ID or --order-ids=ID1,ID2"
    );
  }

  return parsed;
};

const run = async () => {
  const { orderIds, dryRun } = parseArgs();

  try {
    console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔑 PayPal Client ID (first 20 chars): ${process.env.PAYPAL_CLIENT_ID?.substring(0, 20)}...`);
    console.log(`🔑 PayPal API Base: ${PAYPAL_API_BASE}\n`);

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();
    console.log("✅ Access token obtained successfully\n");

    console.log(`📦 Processing ${orderIds.length} order ID(s)\n`);

    let processed = 0;
    let failed = 0;

    for (const orderId of orderIds) {
      console.log(`🔄 Processing order: ${orderId}`);

      if (dryRun) {
        console.log(`📋 DRY RUN: Would capture order ${orderId}`);
        processed += 1;
        continue;
      }

      try {
        const captureResponse = await axios.post(
          `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log(`✅ Captured ${orderId}`);
        console.log(`   Status: ${captureResponse.data?.status}`);
        console.log(`   Response: ${JSON.stringify(captureResponse.data, null, 2)}`);
        processed += 1;
      } catch (error: any) {
        failed += 1;
        const errorMsg =
          error?.response?.data?.message ||
          error?.response?.statusText ||
          error?.message ||
          "Unknown error";
        const errorCode = error?.response?.status || "N/A";
        console.error(`❌ Failed to capture ${orderId}: [${errorCode}] ${errorMsg}`);
        if (error?.response?.data) {
          console.error(JSON.stringify(error.response.data, null, 2));
        }
      }
    }

    console.log("\n📈 === SUMMARY ===");
    console.log(`Total Processed: ${processed}`);
    console.log(`Total Failed: ${failed}`);
    console.log(`Dry Run Mode: ${dryRun}`);
  } catch (error: any) {
    const errorData = error?.response?.data || error?.message || error;
    const errorStatus = error?.response?.status;
    
    console.error("\n🔥 Script error:");
    
    if (errorStatus === 401 || error?.response?.data?.error === 'invalid_client') {
      console.error("❌ Authentication Failed: Invalid or expired PayPal credentials");
      console.error("   - Verify PAYPAL_CLIENT_ID in .env is correct");
      console.error("   - Verify PAYPAL_SECRET_KEY in .env is correct");
      console.error("   - Check if credentials match the environment (sandbox vs production)");
    }
    
    console.error(errorData);
    process.exitCode = 1;
  }
};

run();
