import { Router } from "express";
import AdminTransactionController from "../controllers/adminTransactionController";
import { authenticate, authorizeRole } from "../middleware/authentication";



const router = Router();

// Admin dashboard Transactions Tab Route
router.get("/admin-transactions", authenticate, authorizeRole('admin'), AdminTransactionController.getTransactionSummaryNew);



export default router;