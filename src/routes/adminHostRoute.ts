import { Router } from "express";
import AdminHostController from "../controllers/adminHostController";
import { authenticate, authorizeRole } from "../middleware/authentication";



const router = Router();

// Admin dashboard Host Tab Route
router.get("/admin-hosts", authenticate, authorizeRole('admin'), AdminHostController.getAllHostSummary);

// Admin fetch Host details by ID for Host Tab Route
router.get("/admin-host/:hostId", authenticate, authorizeRole('admin'), AdminHostController.getAnHostDetails);

// Admin suspend / make Active Host Route
router.put("/admin-host/status/:hostId", authenticate, authorizeRole('admin'), AdminHostController.suspendOrMakeActiveHost);

// Admin disable / enable Host Route
router.put("/admin-host/disable/:hostId", authenticate, authorizeRole('admin'), AdminHostController.disableOrEnableHost);



export default router;