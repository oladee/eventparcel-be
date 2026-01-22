import { Router } from "express";
import AdminEventController from "../controllers/adminEventController";
import { authenticate, authorizeRole } from "../middleware/authentication";
import { getAdminDashboardData } from "../controllers/dashboardController";
// import { upload } from '../middleware/multer';

const router = Router();

// Admin dashboard Events Tab Route
router.get("/admin-events", authenticate, authorizeRole('admin'), AdminEventController.getEventSummary);

// Admin dashboard An Event Tab Route
router.get("/admin-event/:eventId", authenticate, authorizeRole('admin'), AdminEventController.getAnEventSummary);




export default router;