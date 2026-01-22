import { ActivityLogModel } from "../models/activityLogModel";
import { IActivityLog } from "../interfaces/modelInterface";
import mongoose from "mongoose";

class ActivityLogService {
  /**
   * Create a new ActivityLog
   */
  static async createActivityLog(
    data: Partial<IActivityLog>
  ): Promise<IActivityLog | null> {
    return await ActivityLogModel.create(data);
  }

  /**
   * Get a single ActivityLog by ID
   */
  static async getOneById(id: string): Promise<IActivityLog | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid ID format");
    }
    return await ActivityLogModel.findById(id)
    .populate("group", "groupName groupDescription groupCurrency groupPrivacy isDisabled link contacts isDraft")
    .populate("event", "eventName eventDescription eventLocation date time")
    .populate("user", "firstName lastName email role");
  }

  /**
   * Get a ActivityLog by field
   */
  static async getOneByField(
    query: Partial<IActivityLog>
  ): Promise<IActivityLog | null> {
    return await ActivityLogModel.findOne(query as any)
    .populate("group", "groupName groupDescription groupCurrency groupPrivacy isDisabled link contacts isDraft")
    .populate("event", "eventName eventDescription eventLocation date time")
    .populate("user", "firstName lastName email role");
  }

  /**
   * Get all ActivityLogs
   */
  static async getAll(
    filter: any = {}
    // skip = 0,
    // limit = 10
  ): Promise<IActivityLog[]> {
    return await ActivityLogModel.find(filter)
    .populate("group", "groupName groupDescription groupCurrency groupPrivacy isDisabled link contacts isDraft")
    .populate("event", "eventName eventDescription eventLocation date time")
    .populate("user", "firstName lastName email role")
    // .skip(skip)
    // .limit(limit);
  }

  /**
   * Update a ActivityLog by ID
   */
  static async updateById(
    id: string,
    data: Partial<IActivityLog>
  ): Promise<IActivityLog | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid ID format");
    }
    return await ActivityLogModel.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Delete a ActivityLog by ID
   */
  static async deleteById(id: string): Promise<IActivityLog | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid ID format");
    }
    return await ActivityLogModel.findByIdAndDelete(id);
  }

  /**
   * Count the number of ActivityLogs based on a filter
   */
  public static async countActivityLog(filter: any) {
    return ActivityLogModel.countDocuments(filter);
  }

  /**
   * Utility: Log an activity entry
   */
  public static async logActivity({
    user,
    event,
    group,
    action,
    actionType,
    entity,
    entityType,
    meta,
  }: {
    user: string;
    event?: string;
    group?: string;
    action: string;
    actionType: string;
    entity: string;
    entityType?: string;
    meta?: {
        entityId?: string;
        [key: string]: any;
      };
  }): Promise<IActivityLog | null> {
    return await this.createActivityLog({
      user: new mongoose.Types.ObjectId(user),
      event: event ? new mongoose.Types.ObjectId(event) : undefined,
      group: group ? new mongoose.Types.ObjectId(group) : undefined,
      action,
      actionType,
      entity,
      entityType,
      meta,
    });
  }
}

export default ActivityLogService;
