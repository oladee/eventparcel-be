import helmet from 'helmet';
// import csurf from 'csurf';
import cookieParser from 'cookie-parser';
import { RateLimiterMongo } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ErrorHandler } from "../utils/errorHandler/errorHandler";

// const csrfProtection = csurf({ cookie: true });

let rateLimiter: RateLimiterMongo;

export const initRateLimiter = () => {
  const mongoClient = mongoose.connection.getClient();
  const dbName = mongoose.connection.db?.databaseName;

  if (!dbName) {
    throw new Error('MongoDB must be connected before initializing rate limiter');
  }

  rateLimiter = new RateLimiterMongo({
    storeClient: mongoClient,
    dbName,
    tableName: 'rateLimits',
    points: 30,
    duration: 60,
    blockDuration: 60,
    keyPrefix: 'rate-limit',
  });
};

// export const rateLimitMiddleware = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     await rateLimiter.consume(req.ip || 'anonymous');
//     next();
//   } catch (rej: any) {
//     const retrySecs = Math.ceil(rej.msBeforeNext / 1000) || 60;
//     res.set('Retry-After', String(retrySecs));
//     return ErrorHandler.tooManyRequests(res, 'Too many requests - try again later.');
//   }
// };

const getResetDate = (ms?: number) => {
  if (typeof ms !== 'number' || isNaN(ms)) {
    return new Date(Date.now() + 60 * 1000).toISOString(); // fallback 1 min
  }
  return new Date(Date.now() + ms).toISOString();
};

export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const rateLimitRes = await rateLimiter.consume(req.ip || 'anonymous');

    // Set headers manually
    res.setHeader('X-RateLimit-Limit', rateLimiter.points);
    res.setHeader('X-RateLimit-Remaining', rateLimitRes.remainingPoints);
    res.setHeader('X-RateLimit-Reset', getResetDate(rateLimitRes.msBeforeNext));

    next();
  } catch (rej: any) {
    const retrySecs = Math.ceil(rej.msBeforeNext / 1000) || 60;
    res.setHeader('Retry-After', String(retrySecs));
    res.setHeader('X-RateLimit-Limit', rateLimiter.points);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('X-RateLimit-Reset', getResetDate(rej.msBeforeNext));

    return ErrorHandler.tooManyRequests(res, 'Too many requests - try again later.');
  }
};


const securityConfig = (app: any) => {
  // app.use(helmet());

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", 'https://app.eventparcel.com'],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://app.eventparcel.com'],
        connectSrc: ["'self'", 'https://app.eventparcel.com'],
        imgSrc: ["'self'", 'data:', 'https://app.eventparcel.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://app.eventparcel.com'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  })
);

// Add HSTS separately to avoid override issues
app.use(
  helmet.hsts({
    maxAge: 63072000, // 2 years in seconds
    includeSubDomains: true,
    preload: true,
  })
);

  app.use(cookieParser());          // Required for CSRF with cookies
  app.use(rateLimitMiddleware);     // Apply early
  // app.use(csrfProtection);          // After cookie parsing
  // app.use((req: Request, res: Response, next: NextFunction) => {
  //   res.locals.csrfToken = req.csrfToken();
  //   next();
  // });
};

export default securityConfig;
