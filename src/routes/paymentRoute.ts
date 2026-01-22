import { Router } from "express";
import { validateBankAccount, fetchPaymentHistory } from "../controllers/paymentController";
import PlaidIntegrationController from "../controllers/plaidController";
import { authenticate } from "../middleware/authentication";
import { optionalAuthenticate } from "../middleware/optionalAuthenticate";
import { upload } from '../middleware/newMulter';
import { replayMissedPayments, replaySinglePayment, reprocessShipment } from "../controllers/replayFailedpayment";

const router = Router();

// Verify Bank Account (NGN)
router.post("/validate-bank-account", validateBankAccount);

// Fetch payment history for a specific host
router.get("/payment-history/:hostId", fetchPaymentHistory);
// router.get("/payment-history", fetchPaymentHistory);

// Fetch US bank account details using the Plaid API
router.post('/plaid/public-token', PlaidIntegrationController.fetchPublicToken);
router.get('/plaid/bank-details', PlaidIntegrationController.getBankAccountDetails);

router.post("/replay-missed-payments", replayMissedPayments);

router.post("/replay-missed-payment", replaySinglePayment);

router.post("/reprocess-shipment", reprocessShipment);



export default router;