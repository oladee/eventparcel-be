import { Router } from "express";
import AdminOrderController from "../controllers/adminOrderController";
import { authenticate, authorizeRole } from "../middleware/authentication";
import { getAdminDashboardData } from "../controllers/dashboardController";



const router = Router();

// Admin dashboard Orders Tab Route
router.get("/admin-orders", authenticate, authorizeRole('admin'), AdminOrderController.getOrderSummary);

// Admin dashboard An Order Detail Tab Route
router.get("/admin-order/:orderId", authenticate, authorizeRole('admin'), AdminOrderController.getAnOrderDetails);



export default router;