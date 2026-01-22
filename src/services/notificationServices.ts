import { notificationModel } from "../models/notificationModel";
import { INotification } from "../interfaces/modelInterface";

export class NotificationService {
    // Create a new Notification
    public static async createNotification(values: Record<string, any>): Promise<INotification> {
        const notification = new notificationModel(values);
        await notification.save();
        return notification;
    }

    // Get Notification by ID
    public static getNotificationById(notificationId: string): Promise<INotification | null> {
        return notificationModel.findById(notificationId).populate("user");
    }

    // Get Notification by Field
    public static getNotificationByField(filter: any = {}): Promise<INotification | null> {
        return notificationModel.findOne(filter).populate("user");
    }

    // Get all Notifications
    public static getAllNotifications(filter: any = {}, skip = 0, limit = 10): Promise<INotification[]> {
        return notificationModel.find(filter)
        .populate("user")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    }

    // Update Notification by ID
    public static updateNotificationById(id: string, values: Record<string, any>, newOption: boolean = true): Promise<INotification | null> {
        return notificationModel.findByIdAndUpdate(id,  values,  { new: newOption });
    }

    // Delete an Notification by its ID
    public static deleteNotificationById(notificationId: string): Promise<INotification | null> {
        return notificationModel.findOneAndDelete({ notificationId });
    }

    // Delete multiple notifications by their IDs
    public static deleteMultipleNotificationsById(notificationIds: string[]): Promise<{ deletedCount?: number }> {
        return notificationModel.deleteMany({
            _id: { $in: notificationIds }
         }).exec();
    }

    public static async countNotifications(filter: any) {
        return notificationModel.countDocuments(filter);
    }
}

