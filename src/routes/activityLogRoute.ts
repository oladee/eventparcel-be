import { Router } from "express";
import { ActivityLogController } from "../controllers/activityLogController";
import { authenticate } from "../middleware/authentication";


const router = Router();
// Get all activity logs for a specific CoHost
router.get("/get-activity-logs/:coHostId", authenticate, ActivityLogController.getAllActivityLogs);

// Get all activity logs for a specific coHost for an Event 
router.get("/get-activity-logs/:coHostId/:eventId", authenticate, ActivityLogController.getAllActivityLogsForAnEvent);

// Get all dummy data activity logs for a specific CoHost
router.get("/get-activity-logs-dummy/:coHostId", authenticate, ActivityLogController.getDummyActivityLogs);



export default router;
