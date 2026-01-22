import { Router } from "express";
import {
    getUserDataSummaryHandler, deleteUserAccountHandler, cleanUnverifiedUsersHandler,
} from "../controllers/deletionController";

const router = Router();

// Fetch user data before deletion 
router.get("/deletion-summary", getUserDataSummaryHandler);

// Delete user account and all related data
router.delete("/delete-user", deleteUserAccountHandler);

// Clean up unverified users (could be scheduled as a cron job)
router.delete("/clean-unverified-users", cleanUnverifiedUsersHandler);

export default router;