import "./types";
import 'express-async-errors';
import express, { Application, Request, Response, NextFunction } from "express";
// import "./utils/express";
import bodyParser from "body-parser";
import cors, { CorsOptions } from "cors";
import compression from "compression";
import MongoStore from "connect-mongo";
import { connectDB } from "./config/dbConfig";
import userRoute from './routes/userRoute';
import passport from "passport";
import session from "express-session";
import authRoutes from "./routes/authRoute";
import eventRoute from "./routes/eventRoute";
import contactsRoute from "./routes/contactsRoute";
import paymentDeliveryRoute from "./routes/paymentDeliveryRoute";
import messageRoute from "./routes/messageRoute";
import dashboardRoute from "./routes/dashboardRoute";
import orderRoute from "./routes/orderRoute";
import discountRoute from "./routes/discountRoute";
import activityLogRoute from "./routes/activityLogRoute";
import paymentRoute from "./routes/paymentRoute";
import notificationRoute from "./routes/notificationRoute";
import webhookRoute from "./routes/webhookRoute";
import adminRoute from "./routes/adminRoute";
import adminEventRoute from "./routes/adminEventRoute";
import adminOrderRoute from './routes/adminOrderRoute';
import adminDeliveryRoute from './routes/adminDeliveryRoute';
import adminTransactionRoute from './routes/adminTransactionRoute';
import adminFeeSummaryRoute from './routes/feeSummaryRoutes';
import adminHostRoute from './routes/adminHostRoute';
import adminStateRoute from './routes/adminStateRoute';
import adminDeliveryFeeAuditLogRoute from './routes/adminDeliveryFeeAuditLogRoute';
import adminBillingRoute from "./routes/adminBillingRoute";
import deletionRoute from './routes/deletionRoute';
import monitorRoutes from "./routes/monitor";
import deliveryFee from "./routes/deliveryFeeRoute";
// import './workers/payoutWorker';
import "./strategies/strategy";
import dotenv from "dotenv";
import { errorHandler } from "./utils/errorHandler/errorMiddleware";
// import "./cron-job/nairaWithdrawalJob";
import "./cron-job/replayMissedGIGcaptureJob";
import "./cron-job/exchangeRateUpdateJob";
import { WhatsAppWebhook } from './controllers/whatsappWebhook';
import { StatusTracker } from './controllers/whatsappStatusTracker';
import securityConfig, { initRateLimiter } from './config/securityConfig';


dotenv.config();

// Normalize origins to avoid mismatches due to trailing slashes or casing
const normalizeOrigin = (o?: string) =>
  o ? o.replace(/\/$/, "").toLowerCase() : o;

// Read CORS whitelist from env; support comma/semicolon/whitespace/newlines
const parseCorsWhitelist = (raw?: string): (string | undefined)[] => {
  if (!raw) return [];
  const parts = raw
    .split(/[\s,;]+/) // split by comma, semicolon, or any whitespace
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
  // Deduplicate while preserving order
  return Array.from(new Set(parts));
};

const app: Application = express();
const envWhitelistRaw = process.env.CORS_WHITELIST;
const envWhitelist = parseCorsWhitelist(envWhitelistRaw);



const defaultDevWhitelist: string[] = [
  "https://event-parcel-version2.vercel.app",
  "https://event-parcel.vercel.app",
  "https://api.eventparcel.com",
  "https://app.eventparcel.com",
  "https://eventparcel.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174"
];

const normalizedWhitelist =
  envWhitelist.length > 0 ? envWhitelist : defaultDevWhitelist;

const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: string | boolean) => void) => {
    if (!origin || normalizedWhitelist.includes(<string>normalizeOrigin(origin))) {
      callback(null, true); // ✅ Allow the request
    } else {
      console.warn('❌ CORS Rejected:', origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  credentials: true
};

// Use CORS Middleware
app.use(cors(corsOptions));

// Middleware to parse raw body for the Paystack webhook
app.use('/api/v1/paystack-webhook', express.raw({ type: 'application/json' }));

// Middleware to add raw body to req object
app.use('/api/v1/paystack-webhook', (req, res, next) => {
  if (req.headers['x-paystack-signature']) {
    (req as Express.Request).rawBody = req.body; // Use raw body for signature verification
  }
  next();
});


// Middleware to parse raw body for the Hyperwallet webhook
app.use('/api/v1/hyperwallet-webhook', express.raw({ type: 'application/json' }));

// Attach raw body to req object for signature verification
app.use('/api/v1/hyperwallet-webhook', (req, res, next) => {
  (req as Express.Request).rawBody = req.body;
  next();
});


// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false })); // Important! Twilio sends data as x-www-form-urlencoded
// app.use(bodyParser.urlencoded({ extended: true })); 
app.use(compression());
app.use(
  session({
    secret: process.env.JWT_SECRET as string,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI as string, // Your MongoDB connection string
      collectionName: "sessions",
      autoRemove: "interval",
      autoRemoveInterval: 10,
    }),
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);


app.use(passport.initialize());
app.use(passport.session());

// WhatsApp Status Tracker
const tracker = new StatusTracker();

// Initialize webhook handler
const whatsappWebhook = new WhatsAppWebhook({
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token',
  appSecret: process.env.META_APP_SECRET,
  onMessage: (message) => {
    console.log('Processing message:', message);
    // Add your message handling logic here
  },
  onStatusUpdate: (statuses) => {
    statuses.forEach((status: any) => {
      tracker.updateStatus(status.id, status.status);

      // ✅ Log it to Render logs
      console.log(`🔄 Status Update:
      Message ID: ${status.id}
      Status: ${status.status}
      Timestamp: ${new Date().toISOString()}
    `);
    });
  }
});

// Add the Security Config
securityConfig(app);

// BullMQ UI Monitoring
app.use(monitorRoutes);

app.get('/', async (req: Request, res: Response): Promise<Response> => {
  return res.send("Welcome to Event Parcel API");
});

// WhatsApp Webhook Verification Route
app.get('/api/v1/whatsapp-webhook', whatsappWebhook.verifyWebhook.bind(whatsappWebhook));
app.post('/api/v1/whatsapp-webhook', whatsappWebhook.handleWebhook.bind(whatsappWebhook));

// Optional: add a way to check status by message ID
app.get('/api/v1/message-status/:id', (req, res) => {
  const status = tracker.getStatus(req.params.id);
  if (!status) return res.status(404).json({ message: 'Status not found' });
  res.json(status);
});

// RESTful API Routes
app.use('/api/v1', userRoute);
app.use("/auth", authRoutes);
app.use("/api/v1", eventRoute);
app.use("/api/v1", contactsRoute);
app.use("/api/v1", paymentDeliveryRoute);
app.use("/api/v1", messageRoute);
app.use("/api/v1", dashboardRoute);
app.use("/api/v1", orderRoute);
app.use("/api/v1", discountRoute);
app.use("/api/v1", activityLogRoute);
app.use("/api/v1", paymentRoute);
app.use("/api/v1", notificationRoute);
app.use("/api/v1", webhookRoute);
app.use('/api/v1', adminRoute);
app.use('/api/v1', adminEventRoute);
app.use('/api/v1', adminOrderRoute);
app.use('/api/v1', adminDeliveryRoute);
app.use('/api/v1', adminTransactionRoute);
app.use('/api/v1', adminFeeSummaryRoute);
app.use('/api/v1', adminHostRoute);
app.use('/api/v1', adminStateRoute);
app.use('/api/v1', adminDeliveryFeeAuditLogRoute);
app.use('/api/v1', adminBillingRoute);
app.use('/api/v1', deletionRoute);
app.use('/api/v1', deliveryFee);


// Handle undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});


// Error handling middleware
app.use(errorHandler);


const PORT = process.env.PORT || 4000;

(async () => {
  try {
    // Connect to the Database
    await connectDB();
    initRateLimiter(); // Ensure DB is connected before calling this

    // securityConfig(app);

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`🔧 Bull Dashboard UI available at http://localhost:${PORT}/admin/queues`);
    });
  } catch (error) {
    console.error("Error starting the server:", error);
  }
})()
