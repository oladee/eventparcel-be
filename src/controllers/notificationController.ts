import { Request, Response } from "express";
import { NotificationService } from "../services/notificationServices";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { AuthenticatedRequest } from "../middleware/authentication";
import { toTitleCase } from "../helpers/helpers";


export class NotificationController {
  // Get a single Notification by ID
  static async getOne(req: AuthenticatedRequest, res: Response): Promise<Response | undefined> {
    try {
      const { userId, hostId, firstName, lastName } = req.user;
      if (req.user && userId !== hostId) return ErrorHandler.unauthenticated(res, "User not authorized!")

        const notifyId = req.params.notifyId;
      if (!notifyId) return ErrorHandler.badUserInput(res, "Notification ID is required");

      const notification = await NotificationService.getNotificationById(notifyId);
      if (!notification) return ErrorHandler.notFound(res, "Notification not found");

      return sendResponse(res, 200, `${toTitleCase(firstName)} ${toTitleCase(lastName)}'s notification fetched successfully`, notification);

    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
      }
  }


  // Get all Notifications
  static async getAll(req: AuthenticatedRequest, res: Response): Promise<Response | undefined> {
    try {
      const { userId, firstName, lastName, hostId } = req.user;
      if (req.user && userId !== hostId) return ErrorHandler.unauthenticated(res, "User not authorized!")

      const notifications = await NotificationService.getAllNotifications({ user: userId });
      if (notifications.length === 0) return sendResponse(res, 200, `No notification found for ${toTitleCase(firstName)} ${toTitleCase(lastName)}`, []);

      // Send response
      return sendResponse(res, 200, `${toTitleCase(firstName)} ${toTitleCase(lastName)}'s notifications fetched successfully`, notifications);

    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
      }
  }

  
  // Delete a Notification by ID
  static async delete(req: AuthenticatedRequest, res: Response): Promise<Response | undefined> {
    try {
       const { role } = req.user;
      if (req.user && role !== 'host') return ErrorHandler.unauthenticated(res, "User not authorized!")

      const notifyId = req.params.notifyId;
      if (!notifyId) return ErrorHandler.badUserInput(res, "Notification ID is required");

      const deleteNotification = await NotificationService.deleteNotificationById(notifyId);
        if (!deleteNotification) return ErrorHandler.badUserInput(res, "Unable to delete notification!");

        // send Response 
        return sendResponse(res, 200, "Notification deleted successfully");

    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
      }
  }


// Delete multiple notifications by IDs
static async deleteManyById(req: AuthenticatedRequest, res: Response): Promise<Response | undefined> {
  try {
    const user = req.user;
    if (!user || user.role !== 'host') {
      return ErrorHandler.unauthenticated(res, "User not authorized!");
    }

    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return ErrorHandler.badUserInput(res, "notificationIds must be a non-empty array.");
    }

    const result = await NotificationService.deleteMultipleNotificationsById(notificationIds);

    if (!result || result.deletedCount === 0) {
      return ErrorHandler.badUserInput(res, "No notifications were deleted.");
    }

    return sendResponse(res, 200, `${result.deletedCount} notification(s) deleted successfully`);
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
}



}
