import Hyperwallet from "hyperwallet-sdk";

const isProd = process.env.NODE_ENV === "production";

const hwClient = new Hyperwallet({
  username: process.env.HYPERWALLET_USERNAME!,
  password: process.env.HYPERWALLET_PASSWORD!,
  programToken: process.env.HYPERWALLET_PROGRAM_TOKEN!,
  server: isProd ? "https://api.hyperwallet.com" : "https://sandbox.hyperwallet.com",
});

export default hwClient;
