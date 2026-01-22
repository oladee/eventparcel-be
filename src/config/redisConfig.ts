// import Redis from 'ioredis';
// import dotenv from 'dotenv';
// import { RedisOptions } from 'bullmq';

// dotenv.config();

// const redisUrl = process.env.REDIS_URL;
// const host = process.env.REDIS_HOST;
// const port = parseInt(process.env.REDIS_PORT || "6379", 10);
// const password = process.env.REDIS_PASSWORD;

// const isSecure = redisUrl?.startsWith("rediss://") || redisUrl?.includes("upstash.io");
// const tlsOptions = isSecure ? { tls: {} } : {};

// // 🧠 Retry/backoff strategy to prevent spammy reconnects
// const commonOptions = {
//   maxRetriesPerRequest: null,
//   retryStrategy: (times: number) => {
//     const delay = Math.min(times * 300, 3000);
//     console.warn(`🔁 Redis retry #${times}, retrying in ${delay}ms`);
//     return delay;
//   },
// };

// // Exported config for BullMQ
// export const redisConfig: RedisOptions = redisUrl
//   ? { url: redisUrl, ...tlsOptions, ...commonOptions }
//   : { host, port, password, ...tlsOptions, ...commonOptions };

// // Redis client for manual commands
// const redisClient = redisUrl
//   ? new Redis(redisUrl, { ...tlsOptions, ...commonOptions })
//   : new Redis({
//       host,
//       port,
//       password,
//       db: 0,
//       ...tlsOptions,
//       ...commonOptions
//     });

// redisClient.on("connect", () => {
//   console.log("✅ Connected to Redis server!");
// });

// redisClient.on("ready", () => {
//   console.log("🚀 Redis client ready!");
// });

// redisClient.on("error", (err: Error) => {
//   console.error("❌ Redis client error:", err.message);
// });

// redisClient.on('end', () => {
//   console.warn('🔌 Redis connection ended.');
// });

// redisClient.on('reconnecting', () => {
//   console.warn('🔄 Redis reconnecting...');
// });

// export default redisClient;

import Redis from 'ioredis';
import dotenv from 'dotenv';
import { RedisOptions } from 'bullmq';

dotenv.config();

const redisUrl = process.env.REDIS_URL;
const host = process.env.REDIS_HOST || '127.0.0.1';
const port = parseInt(process.env.REDIS_PORT || '6379', 10);
const password = process.env.REDIS_PASSWORD;

// Common ioredis options
const commonOptions = {
  maxRetriesPerRequest: null, // Allow infinite retries
  enableReadyCheck: false,    // Skip ready check (esp. for Upstash-like services)
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 300, 3000);
    console.warn(`🔁 Redis retry #${times}, retrying in ${delay}ms`);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    const triggers = ['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'NR_CLOSED'];
    const shouldReconnect = triggers.some(t => err.message.includes(t));
    if (shouldReconnect) {
      console.warn(`🔄 Redis reconnect triggered due to error: ${err.message}`);
    }
    return shouldReconnect;
  },
};

// Determine if TLS should be used (Redis Cloud, Upstash, etc.)
const isSecure = redisUrl?.startsWith('rediss://'); // ✅ No need to check for upstash anymore
const connectionOptions = {
  ...(isSecure ? { tls: {} } : {}),
  ...commonOptions,
};


// BullMQ config
export const redisConfig: RedisOptions = redisUrl
  ? {
      url: redisUrl,
      ...connectionOptions,
      ...commonOptions,
    }
  : {
      host,
      port,
      password,
      db: 0,
      ...connectionOptions,
      ...commonOptions,
    };

// Manual Redis client (for .set, .get, etc.)
const redisClient = redisUrl
  ? new Redis(redisUrl, {
      ...connectionOptions,
      ...commonOptions,
    })
  : new Redis({
      host,
      port,
      password,
      db: 0,
      ...connectionOptions,
      ...commonOptions,
    });

// Redis connection event handlers
redisClient.on('connect', () => {
  console.log('✅ Connected to Redis server!');
});

redisClient.on('ready', () => {
  console.log('🚀 Redis client ready!');
});

redisClient.on('error', (err: Error) => {
  console.error('❌ Redis client error:', err.message);
});

redisClient.on('end', () => {
  console.warn('🔌 Redis connection ended.');
});

redisClient.on('reconnecting', () => {
  console.warn('🔄 Redis reconnecting...');
});

export default redisClient;
