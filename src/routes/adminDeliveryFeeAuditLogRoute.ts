import { Router } from "express";
import { authenticate, authorizeRole } from "../middleware/authentication";
import { getAuditLogs } from "../controllers/adminDeliveryFeeAuditLogController";

const router = Router();

router.get("/admin/delivery-fee-audit-logs", authenticate, authorizeRole("admin"), getAuditLogs);

export default router;
