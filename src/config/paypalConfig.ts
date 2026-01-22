// import * as paypal from "@paypal/checkout-server-sdk";

// const environment = process.env.NODE_ENV === "prod"
//   ? new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID!, process.env.PAYPAL_SECRET_KEY!)
//   : new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID!, process.env.PAYPAL_SECRET_KEY!);

// export const paypalClient = new paypal.core.PayPalHttpClient(environment);


import * as paypalSdk from "@paypal/checkout-server-sdk";
import axios from "axios";

// Environment detection
const isProd = process.env.NODE_ENV === "production";

// PayPal Client ID & Secret
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET_KEY!;
const PAYPAL_API_BASE = isProd
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

// SDK Client Setup
const environment = isProd
  ? new paypalSdk.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_SECRET)
  : new paypalSdk.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_SECRET);

export const paypalClient = new paypalSdk.core.PayPalHttpClient(environment);

// Axios for custom API calls (e.g., payouts)
export const paypalRest = axios.create({
  baseURL: PAYPAL_API_BASE,
  auth: {
    username: PAYPAL_CLIENT_ID,
    password: PAYPAL_SECRET,
  },
});

// Get Access Token (for use with non-SDK endpoints)
export async function getPayPalAccessToken(): Promise<string> {
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");

  const response = await paypalRest.post("/v1/oauth2/token", params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return response.data.access_token;
}