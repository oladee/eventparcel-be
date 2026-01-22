import { Router } from "express";
import AdminDeliveryController from "../controllers/adminDeliveryController";
import { authenticate, authorizeRole } from "../middleware/authentication";



const router = Router();

// Admin dashboard Delivery Tab Route
router.get("/admin-delivery", authenticate, authorizeRole('admin'), AdminDeliveryController.getDeliverySummary);



export default router;