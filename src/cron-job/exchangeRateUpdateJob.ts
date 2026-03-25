import cron from "node-cron";
import axios from "axios";
import redisClient from "../config/redisConfig";
import { ExchangeRateModel } from "../models/exchangeRateModel";

const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;
const REDIS_CACHE_TTL_SECONDS = 30 * 60;
const REDIS_RATE_KEY = "exchange-rate:NGN:USD";

export const updateNgnToUsdRate = async (): Promise<void> => {
    try {
        if (!EXCHANGE_RATE_API_KEY) {
            console.warn("⚠️ EXCHANGE_RATE_API_KEY is not set. Skipping exchange rate update.");
            return;
        }

        const response = await axios.get(
            `https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/USD`
        );

        const ngnRate = response?.data?.conversion_rates?.NGN;

        if (!ngnRate || typeof ngnRate !== "number") {
            throw new Error("Unable to fetch valid NGN exchange rate from provider.");
        }

        const computedRate = 1 / ngnRate; // 1 NGN => USD

        await ExchangeRateModel.findOneAndUpdate(
            { from: "NGN", to: "USD" },
            {
                from: "NGN",
                to: "USD",
                rate: computedRate,
                source: "ExchangeRate-API",
                lastFetchedAt: new Date(),
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await redisClient.set(REDIS_RATE_KEY, computedRate.toString(), "EX", REDIS_CACHE_TTL_SECONDS);

        console.log(`✅ Exchange rate updated: 1 NGN = ${computedRate} USD`);
    } catch (error) {
        console.error("❌ Failed to update NGN->USD exchange rate:", error);
    }
};

// Run daily at 11:00 AM
cron.schedule("0 11 * * *", async () => {
    console.log("🕚 Running exchange rate update job (11:00 AM)...");
    await updateNgnToUsdRate();
});

// Run daily at 4:00 PM
cron.schedule("0 16 * * *", async () => {
    console.log("🕓 Running exchange rate update job (4:00 PM)...");
    await updateNgnToUsdRate();
});

export default {};
