import { Request, Response } from "express";
import ActivityLogService from "../services/activityLogService";
import { UserService } from "../services/userServices";
import { EventService } from "../services/eventServices";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { IActivityLog } from "../interfaces/modelInterface";
import { AuthenticatedRequest } from "../middleware/authentication";
import { Types } from "mongoose";


// Controller functions for activity logs
export class ActivityLogController {
  public static async getAllActivityLogs(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | undefined> {
    try {
      // Check if the user is authenticated
      if (!req.user && req.user?.role !== "host") {
        return ErrorHandler.unauthorized(res, "Host not authenticated. Please log in.");
      }

      const { coHostId } = req.params;

      if (!coHostId) {
        return ErrorHandler.badUserInput(res, "CoHost ID is required.");
      }

      const activityLogs: IActivityLog[] = await ActivityLogService.getAll({ user: coHostId });

      if (!activityLogs || activityLogs.length === 0) {
        return sendResponse(res, 200, "No activity logs found for this CoHost.", []);
      }

      return sendResponse(res, 200, "Activity logs retrieved successfully.", activityLogs);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return ErrorHandler.internalServerError(res, error.message);
      }
    }
  }


  public static async getAllActivityLogsForAnEvent(
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> {
  try {
    // Get the cohost ID and event ID from the params
    const { coHostId, eventId } = req.params;
    
    // Check if user is authenticated and has a role
    if (req.user.role !== "host" && req.user._id !== coHostId) {
      return ErrorHandler.unauthorized(res, "Not authorized to view this activity.");
    }

    if (!coHostId) {
      return ErrorHandler.badUserInput(res, "CoHost ID is required.");
    }

    if (!eventId) {
      return ErrorHandler.badUserInput(res, "Event ID is required.");
    }

    // Query logs where 'user' is cohostId and event is eventId
    const activityLogs: IActivityLog[] = await ActivityLogService.getAll({
      user: new Types.ObjectId(coHostId),
      event: new Types.ObjectId(eventId),
    });

    if (!activityLogs.length) {
      return sendResponse(res, 200, "No activity logs found for this CoHost.", []);
    }

    return sendResponse(res, 200, "Activity logs retrieved successfully.", activityLogs);
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
}



  public static async getDummyActivityLogs(req: Request, res: Response) {
    try {

      const { coHostId, eventId } = req.params;
      if (!coHostId) return ErrorHandler.badUserInput(res, "CoHost ID is required");
      // if (!eventId) return ErrorHandler.badUserInput(res, "Event ID is required");

      const coHost = await UserService.getUserById(coHostId);
      if (!coHost) return ErrorHandler.notFound(res, "CoHost not found!");

      // const event = await EventService.getEventById(eventId);
      // if (!event) return ErrorHandler.notFound(res, "Event not found!");

      const coHostData = {
        firstName: coHost.firstName,
        lastName: coHost.lastName,
        email: coHost.email,
        phoneNumber: coHost.phoneNumber,
        role: coHost.role,
      }

      const dummyActivityLogs = [
        {
          timestamp: "2025-05-08T11:04:00Z",
          user: coHostData,
          event: "67dd1f5f48f2e5b414f3efb7",
          action: "Import Contact",
          entity: "General Aso Ebi",
          entityType: "64 Contacts",
          meta: {
            eventGroupID: "67dd1fde48f2e5b414f3efcc",
            description: "Family and Friends Aso Ebi Group",
          },
        },
        {
          timestamp: "2025-05-08T10:30:00Z",
          user: coHostData,
          event: "67dd1f5f48f2e5b414f3efb7",
          action: "Created a Group",
          entity: "General Aso Ebi",
          entityType: "General",
          meta: {
            description: "Group for general invitees",
            currency: "NGN",
          },
        },
        {
          timestamp: "2025-05-07T13:50:00Z",
          user: coHostData,
          event: "67dd1f5f48f2e5b414f3efb7",
          action: "Accepted Invite",
          entity: "James & Jane Wedding Anniversary 2025",
          entityType: "Event",
          meta: {
            coHostEmail: "jane@example.com",
            acceptedAt: new Date("2025-05-07T13:50:00Z"),
            invitedBy: "paul@example.com",
          },
        },
        {
          timestamp: "2025-05-07T12:20:00Z",
          user: coHostData,
          event: "67dd1f5f48f2e5b414f3efb7",
          action: "Invited as Co-Host",
          entity: "James & Jane Wedding Anniversary 2025",
          entityType: "CoHost",
          meta: {
            entityId: "67dd1f6f48f2e5b414f3efbd",
            coHostEmail: "jane@example.com",
            invitedBy: "paul@example.com",
            invitationStatus: "Pending",
          },
        },
      ];
      

      return sendResponse(res, 200, "Activity logs retrieved successfully.", dummyActivityLogs);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return ErrorHandler.internalServerError(res, error.message);
      }
    }
  }
}
