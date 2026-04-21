import { Types } from "mongoose";
import { AdminDeliveryFeeAuditLogModel } from "../models/adminDeliveryFeeAuditLogModel";
import { IAdminDeliveryFeeAuditLog } from "../interfaces/modelInterface";

type LogEntry = {
    action: "create" | "update" | "delete";
    performedBy: string | Types.ObjectId;
    resource: "state" | "city" | "delivery_fee" | "delivery_fee_import";
    resourceId: string | Types.ObjectId;
    details?: Record<string, any>;
};

class AdminDeliveryFeeAuditLogService {
    /**
     * Fire-and-forget audit log write. Never throws — failures are swallowed
     * silently so a logging error never breaks the primary request.
     */
    async log(entry: LogEntry): Promise<void> {
        try {
            await AdminDeliveryFeeAuditLogModel.create({
                action: entry.action,
                performedBy: new Types.ObjectId(entry.performedBy.toString()),
                resource: entry.resource,
                resourceId: new Types.ObjectId(entry.resourceId.toString()),
                details: entry.details ?? {},
            });
        } catch {
            // intentionally silent
        }
    }

    async getAll(filters: {
        resource?: string;
        action?: string;
        performedBy?: string;
        from?: string;
        to?: string;
        page?: number;
        limit?: number;
    } = {}) {
        const query: Record<string, any> = {};

        if (filters.resource) query.resource = filters.resource;
        if (filters.action) query.action = filters.action;
        if (filters.performedBy) query.performedBy = new Types.ObjectId(filters.performedBy);

        if (filters.from || filters.to) {
            query.createdAt = {};
            if (filters.from) query.createdAt.$gte = new Date(filters.from);
            if (filters.to) {
                const to = new Date(filters.to);
                to.setHours(23, 59, 59, 999);
                query.createdAt.$lte = to;
            }
        }

        const page = Math.max(1, filters.page ?? 1);
        const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            AdminDeliveryFeeAuditLogModel.find(query)
                .populate("performedBy", "firstName lastName email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            AdminDeliveryFeeAuditLogModel.countDocuments(query),
        ]);

        return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
}

export default new AdminDeliveryFeeAuditLogService();
