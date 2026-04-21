import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authentication";
import adminDeliveryFeeAuditLogService from "../services/adminDeliveryFeeAuditLogService";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";

/**
 * GET /api/v1/admin/delivery-fee-audit-logs
 *
 * Query params:
 *   resource  — state | city | delivery_fee | delivery_fee_import
 *   action    — create | update | delete
 *   from      — YYYY-MM-DD
 *   to        — YYYY-MM-DD
 *   page      — default 1
 *   limit     — default 20 (max 100)
 */
export const getAuditLogs = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
    try {
        const { resource, action, from, to, page, limit } = req.query as Record<string, string>;

        const result = await adminDeliveryFeeAuditLogService.getAll({
            resource,
            action,
            from,
            to,
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
        });

        return sendResponse(res, 200, "Audit logs fetched successfully.", result);
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};
