import { Router } from "express";
import {
    paystackWebhook, paypalWebhook, hyperwalletWebhook,
} from "../controllers/webhookController";
import { TwilioSMSwebhook } from "../controllers/twilloWebhookController";
import { manualWithdrawal } from "../controllers/withdrawalController";
import { authenticate, authorizeRole } from "../middleware/authentication";

const router = Router();

// Paystack Webhook (NGN)
router.post("/paystack-webhook", paystackWebhook);

// PayPal Webhook (USD)
router.post("/paypal-webhook", paypalWebhook);

// HyperWallet Webhook (USD Payout)
router.post("/hyperwallet-webhook", hyperwalletWebhook);

// Twilio SMS Webhook 
router.post('/twilio/delivery-status', TwilioSMSwebhook);

// Manual withdrawal
router.post("/manual-withdrawal", authenticate, authorizeRole("admin"), manualWithdrawal);


export default router;