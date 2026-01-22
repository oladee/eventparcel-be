import { Queue } from "bullmq";
import { redisConfig } from "../config/redisConfig";

const BASE_DELAY = 120000; // 2 minutes

export const payoutQueue = new Queue("instant-payout", {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: BASE_DELAY,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});
