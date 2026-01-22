import { Router } from "express";
import FetchFeeSummaryController from '../controllers/feeSummaryController';
import { authenticate, authorizeRole } from "../middleware/authentication";

const router = Router();

router.get('/fee-summary', authenticate, authorizeRole('superAdmin'), FetchFeeSummaryController.fetchFeeSummary);



export default router;
