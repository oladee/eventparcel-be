import { Router } from "express";
import {
    dashboardDummyData, getDashboardData,
} from "../controllers/dashboardController";
import { authenticate } from "../middleware/authentication";
import { optionalAuthenticate } from "../middleware/optionalAuthenticate";
import { upload } from '../middleware/newMulter';

const router = Router();

// Get data for dummy Dashboards
router.get("/dashboard", dashboardDummyData);

// Get data for Dashboards
router.get("/dashboard-data/:hostId", getDashboardData);




export default router;