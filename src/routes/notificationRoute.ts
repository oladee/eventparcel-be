import { Router } from "express";
import { NotificationController } from "../controllers/notificationController";
import { authenticate } from "../middleware/authentication";

const router = Router();

// 📨 Get a single notification by its ID
router.get('/notification/:notifyId', authenticate, NotificationController.getOne);

// 📨 Get all notifications for the authenticated user
router.get('/notifications', authenticate, NotificationController.getAll);

// 🗑️ Delete a single notification by ID
router.delete('/notification/:notifyId', authenticate, NotificationController.delete);

// 🗑️ Delete multiple notifications by their IDs
router.delete('/notifications', authenticate, NotificationController.deleteManyById);

export default router;
