import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { UserService } from "../services/userServices";
import {
  EventService,
  EventGroupService,
  PackageService,
} from "../services/eventServices";
import {
  validateEvent,
  validateUpdatedEvent,
  validateEventGroup,
  validateUpdatedEventGroup,
  validatePackage,
  validateUpdatedPackage,
} from "../middleware/validator";
import {
  uploadImageToCloudinary,
  uploadImage,
  deleteImage,
  toTitleCase,
  parseDateTime,
  formatEventDate,
} from "../helpers/helpers";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import mongoose, { Types } from "mongoose";
import { OptionalAuthenticateRequest } from "../middleware/optionalAuthenticate";
import ActivityLogService from "../services/activityLogService";
import { IEventGroup, IPackage } from "../interfaces/modelInterface";
import { PackageSize, packageSizeWeight } from "../interfaces/interface";
import { SmsLinkService } from "../services/smsLinkServices";
import { OrderService } from "../services/orderServices";
import { AuthenticatedRequest } from "../middleware/authentication";

const FRONTEND_URL = process.env.CLIENT_URL;

// // Function to create a new event
// export const createEvent = async (req: Request, res: Response): Promise<Response | undefined> => {
//     try {
//         const { error } = validateEvent(req.body);
//         if (error) {
//           return ErrorHandler.badUserInput(res, error.details[0].message);
//         }

//         const { eventName, eventDescription, date, time, eventLocation, hostFirstName, hostLastName, hostEmail } = req.body;
//         // Check if the event name already exists
//         const existingEvent = await EventService.getEventByField({eventName: eventName.toLowerCase()});
//         if (existingEvent) {
//             return ErrorHandler.conflict(res, `Event name: ${eventName} already exist! change it.`, { eventName: eventName });
//         }

//         let fileUploader;

//       // Check if a image was uploaded
//       if (req.file) {

//       // Path to the uploaded file
//       const imageFilePath = path.resolve(req.file.path);

//       // Check if the file exists before proceeding
//       if (!fs.existsSync(imageFilePath)) {
//         return res.status(400).json({
//           message: "Uploaded image not found",
//         });
//       }

//   if (req.file.size > 10 * 1024 * 1024) {
//     return ErrorHandler.badUserInput(res, "Cover image must not exceed 10MB in size.");
//   }

//     if (!["image/jpeg", "image/png"].includes(req.file.mimetype)) {
//   return ErrorHandler.badUserInput(res, "Cover image must be a valid image type (JPEG or PNG)");
// }

//     fileUploader = await uploadImage(imageFilePath);
//       }

//         if (fileUploader) {
//         const event = await EventService.createEvent({
//             eventName: eventName.toLowerCase(),
//             eventDescription: eventDescription,
//             eventImgUrl: fileUploader.secure_url || "",
//             eventImgPublicId: fileUploader.public_id || "",
//             user: null,
//             date,
//             time,
//             eventLocation,
//             hostFirstName: hostFirstName.toLowerCase(),
//             hostLastName: hostLastName.toLowerCase(),
//             hostEmail: hostEmail.toLowerCase(),
//         })

//         return sendResponse(res, 200, "Event successfully created!", event);

//       }

//     } catch (error: unknown) {
//         if (error instanceof Error) {
//             console.error("Error in /api/v1/add-event:", error);
//             return ErrorHandler.internalServerError(res, error.message)
//         }
//     } finally {
//         if (req.file && fs.existsSync(req.file.path)) {
//             fs.unlinkSync(path.resolve(req.file.path));
//         }
//     }
// }

// // Function to create a new event
// export const createEvent = async (req: Request, res: Response): Promise<Response | undefined> => {
//     try {
//         // Validate request body
//         const { error } = validateEvent(req.body);
//         if (error) {
//             return ErrorHandler.badUserInput(res, error.details[0].message);
//         }

//         const { eventName, eventDescription, date, time, eventLocation, hostFirstName, hostLastName, hostEmail } = req.body;

//         // Check if event name already exists
//         const existingEvent = await EventService.getEventByField({ eventName: eventName.toLowerCase() });
//         if (existingEvent) {
//             return ErrorHandler.conflict(res, `Event name: ${eventName} already exists! Change it.`, { eventName });
//         }

//         let fileUploader = null;

//         // Handle image upload (if provided)
//         if (req.file) {
//             const imageFilePath = path.resolve(req.file.path);
//           console.log(imageFilePath);

//             // Ensure file exists before proceeding
//             if (!fs.existsSync(imageFilePath)) {
//                 return ErrorHandler.badUserInput(res, "Uploaded image not found.");
//             }

//             // Validate file type & size
//             if (!["image/jpeg", "image/png"].includes(req.file.mimetype)) {
//                 return ErrorHandler.badUserInput(res, "Cover image must be a valid image type (JPEG or PNG)");
//             }

//             if (req.file.size > 10 * 1024 * 1024) {
//                 return ErrorHandler.badUserInput(res, "Cover image must not exceed 10MB in size.");
//             }

//             // Upload image using Cloudinary
//             try {
//                 fileUploader = await uploadImage(imageFilePath);
//             } catch (uploadError) {
//                 console.error("Cloudinary upload failed:", uploadError);
//                 return ErrorHandler.internalServerError(res, "Image upload failed.");
//             }

//             // Remove local file after upload
//             fs.unlinkSync(imageFilePath);
//         }

//         // Create event in database
//         const event = await EventService.createEvent({
//             eventName: eventName.toLowerCase(),
//             eventDescription,
//             eventImgUrl: fileUploader?.secure_url || "",
//             eventImgPublicId: fileUploader?.public_id || "",
//             user: null,
//             date,
//             time,
//             eventLocation,
//             hostFirstName: hostFirstName.toLowerCase(),
//             hostLastName: hostLastName.toLowerCase(),
//             hostEmail: hostEmail.toLowerCase(),
//         });

//         console.log("Event successfully created:", event);
//         return sendResponse(res, 200, "Event successfully created!", event);

//     } catch (error: unknown) {
//         console.error("Error in /api/v1/add-event:", error);
//         return ErrorHandler.internalServerError(res, error instanceof Error ? error.message : "Unknown error");
//     }
// };

// Function to create a new event
export const createEvent = async (
  req: OptionalAuthenticateRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    // Validate request body
    const { error } = validateEvent(req.body);
    if (error) {
      return ErrorHandler.badUserInput(res, error.details[0].message);
    }

    let { hostFirstName, hostLastName, hostEmail, isDraft, } = req.body;

    const {
      eventName,
      eventDescription,
      date,
      time,
      eventLocation,
      numberOfGroups,
    } = req.body;

    // If the user is authenticated, override host details
    if (req.user) {
      hostFirstName = req.user.firstName;
      hostLastName = req.user.lastName;
      hostEmail = req.user.email;
    } else {
      // Ensure non-authenticated users provide host details
      if (!hostFirstName || !hostLastName || !hostEmail) {
        return ErrorHandler.validationError(
          res,
          "Host details are required for non-authenticated users."
        );
      }
    }

    if (req.user?.role === "cohost") {
      const updated = await UserService.promoteUserRole(req.user.userId, "host");

      if (!updated) {
        return ErrorHandler.notFound(res, "User not found");
      }
    }


    let fileUploader = null;

    // Handle image upload (if provided)
    if (req.file) {
      const imageFilePath = path.resolve(req.file.path);
      console.log(`✅ Uploaded file path: ${imageFilePath}`);

      // Ensure the file exists before proceeding
      if (!fs.existsSync(imageFilePath)) {
        return ErrorHandler.badUserInput(res, "Uploaded image not found.");
      }

      // Validate file type & size
      if (!["image/jpeg", "image/png"].includes(req.file.mimetype)) {
        return ErrorHandler.badUserInput(
          res,
          "Cover image must be a valid image type (JPEG or PNG)"
        );
      }

      if (req.file.size > 10 * 1024 * 1024) {
        return ErrorHandler.badUserInput(
          res,
          "Cover image must not exceed 10MB in size."
        );
      }

      // Upload image using Cloudinary
      try {
        fileUploader = await uploadImage(imageFilePath);
        console.log(`✅ Cloudinary Upload Success: ${fileUploader.secure_url}`);
      } catch (uploadError) {
        console.error("❌ Cloudinary upload failed:", uploadError);
        return ErrorHandler.internalServerError(res, "Image upload failed.");
      }

      // Remove local file after upload
      if (fs.existsSync(imageFilePath)) {
        try {
          fs.unlinkSync(imageFilePath);
          console.log(`✅ File deleted: ${imageFilePath}`);
        } catch (unlinkError) {
          console.error("❌ Error deleting file:", unlinkError);
        }
      } else {
        console.warn(`⚠️ File not found for deletion: ${imageFilePath}`);
      }
    }

    if (hostEmail) {
      res.cookie("hostEmail", hostEmail, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 1000 * 60 * 60 * 24, // Expires in 1 day
      });
    }

    if ("isDraft" in req.body && typeof req.body.isDraft === "string") {
      req.body.isDraft = req.body.isDraft === "true";
    }

    // Create event in database
    const event = await EventService.createEvent({
      eventName: eventName,
      eventDescription,
      eventImgUrl: fileUploader?.secure_url || "",
      eventImgPublicId: fileUploader?.public_id || "",
      user: req.user?.userId ?? null,
      date,
      time,
      eventLocation,
      numberOfGroups,
      hostFirstName: hostFirstName.toLowerCase(),
      hostLastName: hostLastName.toLowerCase(),
      hostEmail: hostEmail.toLowerCase(),
      isDraft,
    });

    res.cookie("eventId", event._id, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24, // Expires in 1 day
    });

    console.log("✅ Event successfully created:");
    return sendResponse(res, 200, "Event successfully created!", event);
  } catch (error: unknown) {
    console.error("❌ Error in /api/v1/add-event:", error);
    return ErrorHandler.internalServerError(
      res,
      error instanceof Error ? error.message : "Unknown error"
    );
  } finally {
    if (req.file) {
      const imageFilePath = path.resolve(req.file.path);
      if (fs.existsSync(imageFilePath)) {
        fs.unlinkSync(imageFilePath);
      }
    }
  }
};

// Function to view a particular event
// export const viewEvent = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
//   try {
//     const { eventId } = req.params;
//     if (!eventId) {
//       return ErrorHandler.notFound(res, "eventId not provided!");
//     }

//     const event = await EventService.getEventById(eventId);
//     if (!event) {
//       return ErrorHandler.notFound(res, "Event not found!");
//     }

//     if (event.isDisabled)
//       return ErrorHandler.forbidden(
//         res,
//         "Sorry, this event has been disabled!"
//       );

//     return sendResponse(res, 200, "Event successfully fetched!", event);
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       return ErrorHandler.internalServerError(res, error.message);
//     }
//   }
// };


// Function to view a particular event
export const viewEvent = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
  try {
    const { eventId } = req.params;
    if (!eventId) {
      return ErrorHandler.notFound(res, "eventId not provided!");
    }

    const { hostEmail, userId, role } = req.user || {};
    if (!userId) {
      return ErrorHandler.unauthorized(res, "Unauthorized or missing user ID.");
    }

    const normalizedUserId = new Types.ObjectId(userId);
    const event = await EventService.getEventById(eventId);

    if (!event) {
      return ErrorHandler.notFound(res, "Event not found!");
    }

    if (event.isDisabled) {
      return ErrorHandler.forbidden(res, "Sorry, this event has been disabled!");
    }

    const isCoHost = Array.isArray(event.coHost) &&
      event.coHost.some((coHost: any) => coHost._id?.toString() === normalizedUserId.toString());

    // if (role !== "host" && !isCoHost) {
    //   return ErrorHandler.forbidden(res, "You are not authorized to view this event.");
    // }

    // Display Date and time 
    const displayDateAndTime = formatEventDate(event.date, event.time, "WAT")

    const eventResponse = {
      ...event.toObject(),
      isShared: isCoHost, // If userId is in the coHost array, mark as shared
      display_date_time: displayDateAndTime,
    };

    return sendResponse(res, 200, "Event successfully fetched!", eventResponse);

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};




// Function to view all events
// export const viewAllEvents = async (req: Request, res: Response): Promise<Response | undefined> => {
//   try {
//     const { email } = req.body;
//     if (!email) {
//       return ErrorHandler.validationError(res, "Email not provided!");
//     }
//     const normalizedEmail = email.toLowerCase().trim();

//     const events = await EventService.getEvents({ hostEmail: normalizedEmail });
//     if (!events.length) {
//       return sendResponse(res, 200, "No events found!", []);
//     }

//     return sendResponse(res, 200, "Event successfully fetched!", events);
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       return ErrorHandler.internalServerError(res, error.message);
//     }
//   }
// };


// // Function to view all events
// export const viewAllEvents = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
//   try {
//     const { hostEmail, userId, role } = req.user || {};

//     if (!hostEmail) {
//       return ErrorHandler.unauthorized(res, "Unauthorized or missing host email.");
//     }

//     const events = await EventService.getEvents({ hostEmail: hostEmail.toLowerCase().trim() });

//     if (!events.length) {
//       return sendResponse(res, 200, "No events found!", []);
//     }

//     const normalizedUserId = userId?.toString();

//     const processedEvents = events.map((event: any) => {
//       const isShared =
//         Array.isArray(event.coHost) &&
//         event.coHost.some((coHost: any) => coHost._id?.toString() === normalizedUserId);

//       return {
//         ...event._doc,
//         isShared: isShared || false,
//       };
//     });

//     return sendResponse(res, 200, "Events successfully fetched!", processedEvents);

//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       return ErrorHandler.internalServerError(res, error.message);
//     }
//   }
// };


// export const viewAllEvents = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
//   try {
//     const { hostEmail, userId, role } = req.user || {};

//     if (!userId) {
//       return ErrorHandler.unauthorized(res, "Unauthorized or missing user ID.");
//     }

//     const normalizedUserId = new Types.ObjectId(userId);

//     // Host-based events
//     const hostEvents = hostEmail
//       ? await EventService.getEvents({ hostEmail: hostEmail.toLowerCase().trim() })
//       : [];

//     // Co-host-based events
//     const cohostEvents = await EventService.getEvents({
//       coHost: normalizedUserId, // Mongoose will match if it's in the ObjectId array
//     });

//     // Display Date and time 
//     const displayDateAndTime = formatEventDate(event.date, event.time, (event.timeZone || "WAT"))

//     // Combine both and remove duplicates
//     const combinedEventsMap = new Map<string, any>();

//     [...hostEvents, ...cohostEvents].forEach((event: any) => {
//       const eventId = event._id.toString();

//       const isShared =
//         Array.isArray(event.coHost) &&
//         event.coHost.some((coHost: any) => coHost._id?.toString() === userId.toString());

//       combinedEventsMap.set(eventId, {
//         ...event._doc,
//         isShared,
//       });
//     });

//     const uniqueEvents = role === "host"
//       ? Array.from(combinedEventsMap.values())
//       : Array.from(combinedEventsMap.values()).filter(e => e.isShared);

//     return sendResponse(res, 200, "Events successfully fetched!", uniqueEvents);

//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       return ErrorHandler.internalServerError(res, error.message);
//     }
//   }
// };


export const viewAllEvents = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { hostEmail, userId, role } = req.user || {};

    if (!userId) {
      return ErrorHandler.unauthorized(res, "Unauthorized or missing user ID.");
    }

    const normalizedUserId = new Types.ObjectId(userId);

    // Fetch events where the user is host or cohost
    const hostEvents = hostEmail
      ? await EventService.getEvents({ hostEmail: hostEmail.toLowerCase().trim() })
      : [];

    const cohostEvents = await EventService.getEvents({
      coHost: normalizedUserId,
    });

    // Combine and deduplicate
    const combinedEventsMap = new Map<string, any>();

    [...hostEvents, ...cohostEvents].forEach((event: any) => {
      const eventId = event._id.toString();

      const isHost =
        event.hostEmail?.toLowerCase().trim() === hostEmail?.toLowerCase().trim();

      const isCoHost =
        Array.isArray(event.coHost) &&
        event.coHost.some((coHost: any) => coHost._id?.toString() === userId.toString());

      const isShared = isCoHost;

      const participantRole = isHost ? "host" : isCoHost ? "cohost" : "viewer";

      const formattedDateTime = formatEventDate(
        event.date,
        event.time,
        event.timeZone || "WAT"
      );

      combinedEventsMap.set(eventId, {
        ...event._doc,
        isShared,
        participantRole,
        display_date_time: formattedDateTime
      });
    });

    const uniqueEvents =
      role === "host"
        ? Array.from(combinedEventsMap.values())
        : Array.from(combinedEventsMap.values()).filter((e) => e.isShared);

    return sendResponse(res, 200, "Events successfully fetched!", uniqueEvents);

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};







// Function to update an existing event
export const updateEvent = async (
  req: Request,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { error } = validateUpdatedEvent(req.body);
    if (error) {
      return ErrorHandler.badUserInput(res, error.details[0].message);
    }

    const { eventId } = req.params;
    if (!eventId) {
      return ErrorHandler.notFound(res, "eventId not provided!");
    }

    const event = await EventService.getEventById(eventId);
    if (!event) {
      return ErrorHandler.notFound(res, "Event not found!");
    }

    const eventDateTime = parseDateTime(event.date, event.time);
    if (!req.body.date && (!eventDateTime || eventDateTime.getTime() < new Date().getTime())) {
      return ErrorHandler.badUserInput(res, "You cannot update an event that has already passed!");
    }

    let eventImg: any;
    if (req.file) {
      // Path to the uploaded file
      const imageFilePath = path.resolve(req.file.path);

      // Check if the file exists before proceeding
      if (!fs.existsSync(imageFilePath)) {
        return res.status(400).json({
          message: "Uploaded image not found",
        });
      }

      if (!["image/jpeg", "image/png"].includes(req.file.mimetype)) {
        return ErrorHandler.badUserInput(
          res,
          "Cover image must be a valid image type (JPEG or PNG)"
        );
      }

      if (req.file.size > 10 * 1024 * 1024) {
        return ErrorHandler.badUserInput(
          res,
          "Cover image must not exceed 10MB in size."
        );
      }

      // Upload the image to Cloudinary
      const fileUploader = await uploadImage(
        imageFilePath,
        event.eventImgPublicId
      );

      if (fileUploader) {
        eventImg = fileUploader.secure_url;
      } else {
        return res.status(500).json({ message: "Failed to upload image" });
      }
    }

    const eventData = {
      eventName: req.body.eventName || event.eventName,
      eventDescription: req.body.eventDescription || event.eventDescription,
      eventImgUrl: eventImg || event.eventImgUrl,
      date: req.body.date || event.date,
      time: req.body.time || event.time,
      eventLocation: req.body.eventLocation || event.eventLocation,
      numberOfGroups: req.body.numberOfGroups || event.numberOfGroups,
      hostFirstName:
        req.body.hostFirstName.toLowerCase() || event.hostFirstName,
      hostLastName: req.body.hostLastName.toLowerCase() || event.hostLastName,
      hostEmail: req.body.hostEmail.toLowerCase() || event.hostEmail,
      isDraft: false,
    };

    const updatedEvent = await EventService.updateEventById(
      eventId,
      eventData,
      true
    );
    if (!updatedEvent) {
      return ErrorHandler.validationError(res, "Unable to update event!");
    }

    return sendResponse(res, 200, "Event successfully updated!", updatedEvent);
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(path.resolve(req.file.path));
    }
  }
};

// Function to Enable or Disable an Event
export const disableOrEnableEvent = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { eventId } = req.params;
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return ErrorHandler.badUserInput(res, "Invalid or missing eventId!");
    }

    const event = await EventService.getEventById(eventId);
    if (!event) {
      return ErrorHandler.notFound(res, "Event not found!");
    }

    // Check if the Event has any active guest and have made payment
    const checkActiveGuest = await OrderService.getOrderByField({ eventId: eventId, paymentStatus: "paid" });
    if (checkActiveGuest) return ErrorHandler.conflict(res, "You can't disable event with active guests!");

    const { isDisabled } = req.body;
    if (typeof isDisabled !== "boolean") {
      return ErrorHandler.badUserInput(
        res,
        "User can only input true or false for isDisabled!"
      );
    }

    const updatedEvent = await EventService.updateEventById(
      eventId,
      { isDisabled },
      true
    );
    if (!updatedEvent) {
      return ErrorHandler.validationError(res, "Unable to update event!");
    }

    const message = isDisabled
      ? "Event successfully disabled!"
      : "Event successfully enabled!";

    return sendResponse(res, 200, message, updatedEvent);
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};

// Function to delete a particular event
export const deleteEvent = async (
  req: Request,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { eventId } = req.params;
    if (!eventId) {
      return ErrorHandler.notFound(res, "eventId not provided!");
    }

    const event = await EventService.getEventById(eventId);
    if (!event) {
      return ErrorHandler.notFound(res, "Event not found!");
    }

    // Check if the Event has any active guest and have made payment
    const checkActiveGuest = await OrderService.getOrderByField({ eventId: eventId, paymentStatus: "paid" });
    if (checkActiveGuest) return ErrorHandler.conflict(res, "You can't delete event with active guests!");

    const deletedEvent = await EventService.deleteEventById(eventId);
    if (!deletedEvent) {
      return ErrorHandler.validationError(res, "Unable to delete event data!");
    }

    return sendResponse(res, 200, "Event successfully deleted!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};


// Function to save for later using the isDraft field (Boolean)
export const saveForLater = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
    const { eventId } = req.params;
    if (!eventId)
      return ErrorHandler.badUserInput(res, "Event ID is required!");

    const event = await EventService.getEventById(eventId);
    if (!event) return ErrorHandler.notFound(res, "Event not found!");

    const { isDraft } = req.body;

    const updatedData = {
      isDraft: isDraft ?? event.isDraft
    }

    if (isDraft && typeof isDraft !== "boolean") {
      return ErrorHandler.badUserInput(res, "User can only input true or false for isDraft!");
    }

    const updateIsDraft = await EventService.updateEventById(eventId, updatedData, true);
    if (!updateIsDraft) return ErrorHandler.badUserInput(res, "Unable to save to draft!");

    return sendResponse(res, 200, "Event successfully saved for later!", updateIsDraft);

  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message)
  }
}




//---------------------------------------------------------------------------------------------------------------------------------------
// -- Event Group Logic --
//---------------------------------------------------------------------------------------------------------------------------------------

// Function to create a new event group
export const createEventGroup = async (
  req: OptionalAuthenticateRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { error } = validateEventGroup(req.body);
    if (error) {
      return ErrorHandler.badUserInput(res, error.details[0].message);
    }

    const {
      eventId,
      groupName,
      groupDescription,
      groupCurrency,
      groupPrivacy,
      isDraft,
    } = req.body;

    const event = await EventService.getEventById(eventId);
    if (!event) {
      return ErrorHandler.notFound(res, "Event not found!");
    }

    // Check if the event group name already exists
    const existingEventGroup = await EventGroupService.getEventGroupByField({
      groupName: groupName.trim(),
      event: eventId,
    });
    if (
      existingEventGroup &&
      groupName.toLowerCase().trim() === existingEventGroup.groupName.toLowerCase().trim()
    ) {
      return ErrorHandler.conflict(res, `Event group name: ${req.body.groupName.trim()} already exists for this event.`);
    }

    if (isDraft && typeof isDraft !== "boolean") {
      return ErrorHandler.badUserInput(res, "User can only input true or false for isDraft!");

    }

    // console.log("Event Group Length: ", event?.eventGroups?.length)
    // console.log("Number of Groups: ", event?.numberOfGroups)

    // if (event?.numberOfGroups !== null && (event?.eventGroups?.length || 0) >= Number(event?.numberOfGroups || 0)) {
    //   return ErrorHandler.validationError(
    //     res,
    //     `The number of assigned event groups (${event?.eventGroups?.length}) exceeds the allowed limit (${event?.numberOfGroups}) for this event.`
    //   );
    // }


    const eventGroup = await EventGroupService.createEventGroup({
      groupName: groupName,
      groupDescription: groupDescription || "NA",
      groupCurrency: groupCurrency,
      groupPrivacy: groupPrivacy,
      event: eventId,
      isDraft,
    });

    // Now we push it inside the event for reference
    const referencedEvent = await EventService.addGroupToEvent(
      eventId,
      eventGroup._id.toString()
    );
    if (!referencedEvent) {
      return ErrorHandler.validationError(
        res,
        "Unable to add event group to Event data!"
      );
    }

    // Update event currency flags
    if (groupCurrency === "NGN") event.isNairaAccount = true;
    if (groupCurrency === "USD" || groupCurrency === "CAD")
      event.isDollarAccount = true;
    await event.save();

    const linkData = await SmsLinkService.generateSmsPreviewCode(
      eventId,
      eventGroup._id.toString(),
      "234"
    );
    if (!linkData) {
      throw new Error(`Failed to generate preview token!`);
    }
    eventGroup.link = `${FRONTEND_URL}/preview?code=${linkData}`;
    await eventGroup.save();

    const { userId, role } = req.user || {};
    if (req.user && userId && role === "cohost") {
      // ✅ Log activity for creating Event Group
      await ActivityLogService.logActivity({
        user: userId,
        event: eventId,
        group: eventGroup._id.toString(),
        action: "Created a Group",
        actionType: "Group",
        entity: toTitleCase(groupName),
        entityType: toTitleCase(groupPrivacy),
        meta: {
          eventGroupID: eventGroup._id.toString(),
          description: groupDescription || "NA",
          currency: groupCurrency,
        },
      });
    }

    return sendResponse(res, 200, "Event group successfully created!", eventGroup);
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};

// // Function to view a particular event group
// export const viewEventGroup = async (req: Request, res: Response): Promise<Response | undefined> => {
//   try {
//     const { eventGroupId } = req.params;
//     if (!eventGroupId) {
//       return ErrorHandler.notFound(res, "eventGroupId not provided!");
//     }

//     const eventGroup = await EventGroupService.getEventGroupById(eventGroupId);
//     if (!eventGroup) {
//       return ErrorHandler.notFound(res, "Event Group not found!");
//     }

//     if (eventGroup.isDisabled)
//       return ErrorHandler.forbidden(res, "Sorry, this event group has been disabled!");

//     const totalQuantityForCurrency = (eventGroup.packages as any[])
//       .filter(pkg => pkg.packagePriceCurrency === eventGroup.groupCurrency)
//       .reduce((sum, pkg) => sum + (pkg.packageQuantity || 0), 0);

//     // To get the summaries of an EventGroup
//     const summaries = await OrderService.salesSummaries({eventGroupId});
//     const summaryData = summaries.map((sum) => {
//       const matchingSale = sum.sales.find(
//         (sale) => sale.currency === eventGroup.groupCurrency
//       );

//       return {
//         // eventId: sum.eventId,
//         currency: matchingSale?.currency || eventGroup.groupCurrency,
//         overallSales: matchingSale?.totalSales || 0,
//         packagesSold: matchingSale?.totalPackagesSold || 0,
//         stock: totalQuantityForCurrency,
//       };
//     });

//     // Create a new object with modified groupPrivacy
//     const filteredEventGroup = {
//       ...eventGroup.toObject(), // Ensure it's a plain object
//       //     groupPrivacy: toTitleCase(eventGroup.groupPrivacy),
//       groupName: toTitleCase(eventGroup.groupName),
//       summary: summaryData,
//     };

//     return sendResponse(res, 200, "Event Group successfully fetched!", filteredEventGroup);

//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       return ErrorHandler.internalServerError(res, error.message);
//     }
//   }
// };

export const viewEventGroup = async (req: Request, res: Response): Promise<Response | undefined> => {
  try {
    const { eventGroupId } = req.params;
    if (!eventGroupId) {
      return ErrorHandler.notFound(res, "eventGroupId not provided!");
    }

    // Fetch only necessary fields and populate required references
    const eventGroup = await EventGroupService.getEventGroupById(eventGroupId);

    if (!eventGroup) {
      return ErrorHandler.notFound(res, "Event Group not found!");
    }

    if (eventGroup.isDisabled) {
      return ErrorHandler.forbidden(res, "Sorry, this event group has been disabled!");
    }

    // Use a simple loop instead of filter + reduce
    let totalQuantityForCurrency = 0;
    for (const pkg of eventGroup.packages as any[]) {
      if (pkg.packagePriceCurrency === eventGroup.groupCurrency) {
        totalQuantityForCurrency += pkg.packageQuantity || 0;
      }
    }

    // Get sales summaries once
    const summaries = await OrderService.salesSummariesGroup(eventGroupId);

    const summaryData = summaries.map((sum) => {
      const matchingSale = sum.sales.find(
        (sale: any) => sale.currency === eventGroup.groupCurrency
      );

      return {
        currency: matchingSale?.currency || eventGroup.groupCurrency,
        overallSales: matchingSale?.totalSales || 0,
        packagesSold: matchingSale?.totalPackagesSold || 0,
        stock: totalQuantityForCurrency,
      };
    });

    // Safely convert to plain object & add computed values
    const filteredEventGroup = {
      ...eventGroup.toObject(),
      // groupName: toTitleCase(eventGroup.groupName),
      groupName: eventGroup.groupName,
      summary: summaryData,
    };

    return sendResponse(res, 200, "Event Group successfully fetched!", filteredEventGroup);
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};



// Function to view all event groups
export const viewAllEventGroups = async (
  req: Request,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { eventId } = req.params;
    if (!eventId) {
      return ErrorHandler.notFound(res, "eventGroupId not provided!");
    }

    const eventGroups = await EventGroupService.getEventGroups({
      event: eventId,
    });
    if (!eventGroups.length) {
      return sendResponse(res, 200, "No event groups found!", []);
    }

    // Ensure each eventGroup is converted to an object before modifying
    const filteredEventGroups = eventGroups.map((eventGroup) => ({
      ...eventGroup.toObject(), // Convert Mongoose document to plain object
      groupPrivacy: toTitleCase(eventGroup.groupPrivacy),
      // groupName: toTitleCase(eventGroup.groupName),
      groupName: eventGroup.groupName,
    }));

    return sendResponse(
      res,
      200,
      "Event Groups successfully fetched!",
      filteredEventGroups
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};

// Function to view all event groups by Admin
export const viewAllEventGroupByAdmin = async (
  req: Request,
  res: Response
): Promise<Response | undefined> => {
  try {
    const eventGroups = await EventGroupService.getEventGroups();
    if (!eventGroups.length) {
      return sendResponse(res, 200, "No event groups found!", []);
    }

    return sendResponse(
      res,
      200,
      "Event Groups successfully fetched!",
      eventGroups
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};

// Function to update an existing event groups
export const updateEventGroup = async (
  req: OptionalAuthenticateRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { error } = validateUpdatedEventGroup(req.body);
    if (error) {
      return ErrorHandler.badUserInput(res, error.details[0].message);
    }

    const { eventGroupId } = req.params;
    if (!eventGroupId) {
      return ErrorHandler.notFound(res, "eventGroupId not provided!");
    }

    const eventGroup = await EventGroupService.getEventGroupById(eventGroupId);
    if (!eventGroup) {
      return ErrorHandler.notFound(res, "Event Group not found!");
    }

    const eventGroupData = {
      groupName: req.body.groupName || eventGroup.groupName,
      groupDescription:
        req.body.groupDescription || eventGroup.groupDescription,
      groupCurrency: req.body.groupCurrency || eventGroup.groupCurrency,
      groupPrivacy: req.body.groupPrivacy || eventGroup.groupPrivacy,
      isDraft: false,
    };

    // Check if the event group name already exists
    // Only run this block if groupName is provided
    if (req.body.groupName) {
      const groupNameLower = req.body.groupName.toLowerCase().trim();

      const existingEventGroupName = await EventGroupService.getEventGroupByField({
        groupName: req.body.groupName.trim(),
        event: eventGroup?.event?._id,
      });

      if (
        existingEventGroupName &&
        groupNameLower !== eventGroup.groupName.toLowerCase()
      ) {
        return ErrorHandler.conflict(
          res,
          `Event group name: ${req.body.groupName.trim()} already exists for this event.`
        );
      }
    }


    const updatedEventGroup = await EventGroupService.updateEventGroupById(
      eventGroupId,
      eventGroupData,
      true
    );
    if (!updatedEventGroup) {
      return ErrorHandler.validationError(res, "Unable to update event group!");
    }

    const event = await EventService.getEventById(updatedEventGroup.event);
    if (!event) {
      return ErrorHandler.notFound(res, "Event not found!");
    }

    const packageIds =
      Array.isArray(updatedEventGroup.packages) && updatedEventGroup.packages.length > 0
        ? updatedEventGroup.packages.map((pkg: any) => pkg._id.toString())
        : [];
    // Update the packages with the new group currency
    if (packageIds.length > 0) {
      await PackageService.updatePackagesByIds(
        packageIds,
        { packagePriceCurrency: updatedEventGroup.groupCurrency }
      );
    }

    // // Update event currency flags without overriding existing `true` values
    // if (updatedEventGroup.groupCurrency === "NGN") {
    //   event.isNairaAccount = true;
    // }
    // if (updatedEventGroup.groupCurrency === "USD") {
    //   event.isDollarAccount = true;
    // }


    // Recalculate event currency flags based on ALL groups
    const allEventGroups = await EventGroupService.getEventGroupsByEventId(event._id.toString());

    const hasNairaGroups = allEventGroups.some(
      (group: any) => group.groupCurrency === "NGN"
    );
    const hasDollarGroups = allEventGroups.some(
      (group: any) => group.groupCurrency === "USD"
    );

    event.isNairaAccount = hasNairaGroups;
    event.isDollarAccount = hasDollarGroups;

    // Save the event with updated currency flags
    await event.save();


    // Log activity if the user is a cohost
    const { userId, role } = req.user || {};
    if (req.user && userId && role === "cohost") {
      // ✅ Log activity for updating Event Group
      await ActivityLogService.logActivity({
        user: userId,
        event: updatedEventGroup.event,
        group: eventGroup._id.toString(),
        action: "Updated a Group",
        actionType: "Group",
        entity: toTitleCase(updatedEventGroup.groupName),
        entityType: toTitleCase(updatedEventGroup.groupPrivacy),
        meta: {
          eventGroupID: eventGroup._id.toString(),
          description: updatedEventGroup.groupDescription || "NA",
          currency: updatedEventGroup.groupCurrency,
        },
      });
    }

    return sendResponse(res, 200, "Event Group successfully updated!", updatedEventGroup);

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};

// Function to Enable or Disable an Event Group
export const disableOrEnableEventGroup = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { eventGroupId } = req.params;
    if (!eventGroupId || !mongoose.Types.ObjectId.isValid(eventGroupId)) {
      return ErrorHandler.badUserInput(res, "Invalid or missing eventGroupId!");
    }

    const event = await EventGroupService.getEventGroupById(eventGroupId);
    if (!event) {
      return ErrorHandler.notFound(res, "Event Group not found!");
    }

    const { isDisabled } = req.body;
    if (typeof isDisabled !== "boolean") {
      return ErrorHandler.badUserInput(
        res,
        "User can only input true or false for isDisabled!"
      );
    }

    const updatedEvent = await EventGroupService.updateEventGroupById(
      eventGroupId,
      { isDisabled },
      true
    );
    if (!updatedEvent) {
      return ErrorHandler.validationError(res, "Unable to update event group!");
    }

    const message = isDisabled
      ? "Event Group successfully disabled!"
      : "Event Group successfully enabled!";

    return sendResponse(res, 200, message, updatedEvent);
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};

// // Function to delete a particular event groups
// export const deleteEventGroup = async (req: OptionalAuthenticateRequest, res: Response): Promise<Response | undefined> => {
//     try {
//         const { eventGroupId, } = req.params;
//         if (!eventGroupId) {
//             return ErrorHandler.notFound(res, "eventGroupId not provided!")
//         }

//         const eventGroup = await EventGroupService.getEventGroupById(eventGroupId);
//         if (!eventGroup) {
//             return ErrorHandler.notFound(res, "Event Group not found!");
//         }

//         const deletedEventGroup = await EventGroupService.deleteEventGroupById(eventGroupId);
//         if (!deletedEventGroup) {
//             return ErrorHandler.validationError(res, "Unable to delete event group data!");
//         }

//         const event = await EventService.getEventById(deletedEventGroup.event);
//         if (!event) {
//             return ErrorHandler.notFound(res, "Event not found!");
//         }

//         // Update event currency flags
//         if (deletedEventGroup.groupCurrency === "NGN" && event.isNairaAccount) {
//             event.isNairaAccount = false;
//             await event.save();
//         }

//         if ((deletedEventGroup.groupCurrency === "USD" || deletedEventGroup.groupCurrency === "CAD") && event.isDollarAccount) {
//             event.isDollarAccount = false;
//             await event.save();
//         }

//         const { userId, role } = req.user || {};
//         if (req.user && userId && role === 'cohost') {
//           // ✅ Log activity for deleting Event Group
//           await ActivityLogService.logActivity({
//             user: userId,
//             event: deletedEventGroup.event,
//             action: "Deleted a Group",
//             entity: toTitleCase(deletedEventGroup.groupName),
//             entityType: toTitleCase(deletedEventGroup.groupPrivacy),
//             meta: {
//               description: deletedEventGroup.groupDescription || "NA",
//               currency: deletedEventGroup.groupCurrency,
//             },
//           });
//         }

//         return sendResponse(res, 200, "Event successfully deleted!");

//     } catch (error: unknown) {
//         if (error instanceof Error) {
//             return ErrorHandler.internalServerError(res, error.message)
//         }
//     }
// }

// Function to delete a particular event group
export const deleteEventGroup = async (
  req: OptionalAuthenticateRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { eventGroupId } = req.params;
    if (!eventGroupId) {
      return ErrorHandler.notFound(res, "eventGroupId not provided!");
    }

    // 1) fetch the group
    const eventGroup = await EventGroupService.getEventGroupById(eventGroupId);
    if (!eventGroup) {
      return ErrorHandler.notFound(res, "Event Group not found!");
    }

    // 2) delete the group document
    const deletedGroup = await EventGroupService.deleteEventGroupById(
      eventGroupId
    );
    if (!deletedGroup) {
      return ErrorHandler.validationError(
        res,
        "Unable to delete event group data!"
      );
    }

    // 3) pull it out of the parent Event
    const updatedEvent = await EventService.removeGroupFromEvent(
      deletedGroup.event.toString(),
      eventGroupId
    );
    if (!updatedEvent) {
      return ErrorHandler.validationError(
        res,
        "Group deleted but failed to update parent Event!"
      );
    }

    // 4) update currency flags in one go
    let changed = false;
    if (deletedGroup.groupCurrency === "NGN" && updatedEvent.isNairaAccount) {
      updatedEvent.isNairaAccount = false;
      changed = true;
    }
    if (deletedGroup.groupCurrency === "USD" && updatedEvent.isDollarAccount) {
      updatedEvent.isDollarAccount = false;
      changed = true;
    }
    if (changed) {
      await updatedEvent.save();
    }

    // 5) optional cohost activity log
    const { userId, role } = req.user || {};
    if (userId && role === "cohost") {
      await ActivityLogService.logActivity({
        user: userId,
        event: deletedGroup.event,
        group: deletedGroup._id.toString(),
        action: "Deleted a Group",
        actionType: "Group",
        entity: toTitleCase(deletedGroup.groupName),
        entityType: toTitleCase(deletedGroup.groupPrivacy),
        meta: {
          eventGroupID: deletedGroup._id.toString(),
          description: deletedGroup.groupDescription || "NA",
          currency: deletedGroup.groupCurrency,
        },
      });
    }

    // 6) final response
    return sendResponse(res, 200, "Event Group successfully deleted!");
  } catch (err: unknown) {
    if (err instanceof Error) {
      return ErrorHandler.internalServerError(res, err.message);
    }
  }
};

// Function to Clone an Event Group
export const cloneEventGroup = async (
  req: Request,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { eventGroupId } = req.params;

    // Fetch the original EventGroup
    const originalEventGroup = await EventGroupService.getEventGroupById(
      eventGroupId
    );
    if (!originalEventGroup) {
      return ErrorHandler.notFound(res, "Event Group not found!");
    }

    // Function to generate a unique group name
    const generateUniqueGroupName = async (baseName: string) => {
      let count = 1;
      let newName = baseName;
      while (
        await EventGroupService.getEventGroupByField({ groupName: newName })
      ) {
        newName = `${baseName} Copy ${count}`;
        count++;
      }
      return newName;
    };

    // Generate unique EventGroup name
    const uniqueGroupName = await generateUniqueGroupName(
      originalEventGroup.groupName
    );

    // Clone EventGroup details
    const clonedEventGroup = await EventGroupService.createEventGroup({
      groupName: uniqueGroupName,
      groupDescription: originalEventGroup.groupDescription,
      groupCurrency: originalEventGroup.groupCurrency,
      groupPrivacy: originalEventGroup.groupPrivacy,
      event: new mongoose.Types.ObjectId(originalEventGroup.event),
    });

    // Add the cloned group to the event
    const referencedEvent = await EventService.addGroupToEvent(
      clonedEventGroup.event,
      clonedEventGroup._id
    );
    if (!referencedEvent) {
      return ErrorHandler.validationError(
        res,
        "Unable to add event group to Event data!"
      );
    }

    const linkData = await SmsLinkService.generateSmsPreviewCode(
      clonedEventGroup.event.toString(),
      clonedEventGroup._id.toString(),
      "234"
    );
    if (!linkData) {
      throw new Error(`Failed to generate preview token!`);
    }

    // Generate a preview link for the cloned Event Group
    clonedEventGroup.link = `${FRONTEND_URL}/preview?code=${linkData}`;

    // Fetch all packages associated with the EventGroup
    const originalPackages = await PackageService.getPackages({
      eventGroup: eventGroupId,
    });

    // Function to generate a unique package title
    const generateUniquePackageTitle = async (
      baseTitle: string,
      eventGroupId: string
    ) => {
      let count = 1;
      let newTitle = baseTitle;
      while (
        await PackageService.getPackageByField({
          packageTitle: newTitle,
          eventGroup: eventGroupId,
        })
      ) {
        newTitle = `${baseTitle} Copy ${count}`;
        count++;
      }
      return newTitle;
    };

    // Clone and associate packages
    if (originalPackages && Array.isArray(originalPackages)) {
      for (const originalPackage of originalPackages) {
        // Generate a unique package title
        const uniquePackageTitle = await generateUniquePackageTitle(
          originalPackage.packageTitle,
          clonedEventGroup._id.toString()
        );

        // Clone each package while keeping the same Cloudinary image links
        const clonedPackage = await PackageService.createPackage({
          packageTitle: uniquePackageTitle,
          packageDescription: originalPackage.packageDescription,
          packagePriceCurrency: originalPackage.packagePriceCurrency,
          packagePrice: originalPackage.packagePrice,
          packageQuantity: originalPackage.packageQuantity,
          packageDelivery: originalPackage.packageDelivery,
          eventGroup: new mongoose.Types.ObjectId(clonedEventGroup._id),
          packageImgUrls: originalPackage.packageImgUrls, // Keep existing images
          packageImgPublicIds: originalPackage.packageImgPublicIds, // Keep existing Cloudinary IDs
        });

        // Add cloned package to cloned EventGroup
        clonedEventGroup.packages.push(clonedPackage._id);
        await clonedEventGroup.save();
        //  await EventGroupService.addPackageToEventGroup(clonedEventGroup._id, clonedPackage._id);
      }
    }

    return sendResponse(
      res,
      200,
      "Event Group successfully cloned!",
      clonedEventGroup
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};

//---------------------------------------------------------------------------------------------------------------------------------------
// -- Event Package Logic --
//---------------------------------------------------------------------------------------------------------------------------------------

// Function to create a new package
export const createPackage = async (
  req: OptionalAuthenticateRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { error } = validatePackage(req.body);
    if (error) {
      return ErrorHandler.badUserInput(res, error.details[0].message);
    }

    const {
      eventId,
      groupId,
      packageTitle,
      packageDescription,
      packagePriceCurrency,
      packagePrice,
      packageQuantity,
      packageDelivery,
      packageSize,
      isDraft,
    } = req.body;

    // Check if the Package title already exists
    const existingPackage = await PackageService.getPackageByField({
      packageTitle: packageTitle.toLowerCase(),
      eventGroup: groupId,
    });
    if (existingPackage) {
      return ErrorHandler.conflict(
        res,
        `Package title: ${packageTitle} already exists for this event group.`,
        { packageTitle: packageTitle }
      );
    }

    const eventGroup = await EventGroupService.getEventGroupById(groupId);
    if (!eventGroup) {
      return ErrorHandler.notFound(res, "Event Group not found!");
    }

    const event = await EventService.getEventById(eventId);
    if (!event) return ErrorHandler.notFound(res, "Event not found!");

    // Check if images were uploaded
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: "No images were uploaded" });
    }

    // Check MIME type for each file
    for (const file of req.files) {
      if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
        return ErrorHandler.badUserInput(
          res,
          "All images must be in JPEG or PNG format."
        );
      }

      if (file.size > 10 * 1024 * 1024) {
        return ErrorHandler.badUserInput(
          res,
          "Each image must not exceed 10MB in size."
        );
      }
    }

    // Process multiple image uploads
    const uploadedImages = await Promise.all(
      (req.files as Express.Multer.File[]).map(async (file) => {
        const imageFilePath = path.resolve(file.path);

        // Check if the file exists before proceeding
        if (!fs.existsSync(imageFilePath)) {
          throw new Error("Uploaded image not found");
        }

        // Upload image
        const uploadedImage = await uploadImage(imageFilePath);

        return uploadedImage;
      })
    );

    // Extract image URLs & Public IDs
    const packageImgUrls = uploadedImages.map((img) => img.secure_url);
    const packageImgPublicIds = uploadedImages.map((img) => img.public_id);

    // let packageDeliveryArranged: string[] = [];

    // if (packageDelivery) {
    //   const arrangeDelivery = packageDelivery
    //     .split(",")
    //     .map((str: string) => str.trim());

    //   let homeDeliveryCount = 0;

    //   packageDeliveryArranged = arrangeDelivery.map((delivery: string) => {
    //     const [mainType, subType] = delivery
    //       .split(":")
    //       .map((str) => str.trim());

    //     if (mainType === "homeDelivery" && subType) {
    //       homeDeliveryCount++;
    //       if (homeDeliveryCount > 1) {
    //         throw new Error(
    //           "Only one homeDelivery option (selfManaged or platformDelivery) can be selected."
    //         );
    //       }
    //       return `${mainType}:${subType}`;
    //     }

    //     return mainType; // Keep "pickUp" as it is
    //   });
    // } else {
    //   packageDeliveryArranged = ["pickUp"];
    // }

    // // **Dynamically update event properties**
    // event.isPickUp = packageDeliveryArranged.includes("pickUp");
    // event.isSelfManaged = packageDeliveryArranged.includes(
    //   "homeDelivery:selfManaged"
    // );
    // event.isPlatformDelivery = packageDeliveryArranged.includes(
    //   "homeDelivery:platformDelivery"
    // );

    // await event.save();

    let packageDeliveryArranged: string[] = [];

    if (!packageDelivery) {
      return ErrorHandler.badUserInput(res, "At least one delivery option must be selected.");
    }

    const arrangeDelivery = packageDelivery
      .split(",")
      .map((str: string) => str.trim());

    // Validation: no duplicate delivery options
    const uniqueDelivery = new Set(arrangeDelivery);
    if (uniqueDelivery.size !== arrangeDelivery.length) {
      return ErrorHandler.badUserInput(res, "Duplicate delivery options are not allowed.");
    }

    // Validation: Only one of selfManaged or platformDelivery
    const hasSelfManaged = arrangeDelivery.includes("selfManaged");
    const hasPlatformDelivery = arrangeDelivery.includes("platformDelivery");

    if (hasSelfManaged && hasPlatformDelivery) {
      return ErrorHandler.badUserInput(res, "You cannot select both Self-delivery and Platform Delivery in the same package.");
    }

    // Validation: Platform Delivery disabled for dollar-based groups
    if (eventGroup.groupCurrency === "USD" && hasPlatformDelivery) {
      return ErrorHandler.badUserInput(res, "Platform Delivery is not available for dollar-based groups.");
    }

    // Validate allowed options
    const allowedOptions = ["selfManaged", "platformDelivery", "pickUp"];
    for (const delivery of arrangeDelivery) {
      if (!allowedOptions.includes(delivery)) {
        return ErrorHandler.badUserInput(res, `Invalid delivery option: ${delivery}`);
      }
    }

    packageDeliveryArranged = arrangeDelivery;

    // Update event flags
    event.isPickUp = packageDeliveryArranged.includes("pickUp");
    event.isSelfManaged = packageDeliveryArranged.includes("selfManaged");
    event.isPlatformDelivery = packageDeliveryArranged.includes("platformDelivery");

    await event.save();

    if (isDraft && typeof isDraft !== "boolean") {
      return ErrorHandler.badUserInput(res, "User can only input true or false for isDraft!");
    }

    const packageWeight = packageSizeWeight[packageSize as keyof typeof packageSizeWeight];

    // Create Package
    const eventPackage = await PackageService.createPackage({
      packageTitle: packageTitle.toLowerCase(),
      packageDescription,
      packagePriceCurrency: eventGroup.groupCurrency,
      packagePrice,
      packageQuantity,
      packageDelivery: packageDeliveryArranged,
      eventGroup: groupId,
      packageImgUrls, // Array of image URLs
      packageImgPublicIds, // Array of public IDs
      packageSize: packageWeight,
      isDraft,
    });

    // Now we push it inside the eventGroup for reference
    const addToEventGroup = await EventGroupService.addPackageToEventGroup(
      groupId,
      eventPackage._id.toString()
    );
    if (!addToEventGroup) {
      return ErrorHandler.validationError(
        res,
        "Unable to add package to Event group data!"
      );
    }

    const { userId, role } = req.user || {};
    if (req.user && userId && role === "cohost") {
      // ✅ Log activity for creating Event Package
      await ActivityLogService.logActivity({
        user: userId,
        event: eventId,
        group: groupId,
        action: "Created a Package",
        actionType: "Group",
        entity: toTitleCase(packageTitle),
        entityType: toTitleCase(eventGroup.groupName),
        meta: {
          eventGroupID: groupId,
          packageId: eventPackage._id,
          description: packageDescription || "NA",
          Price: packagePrice,
          Quantity: packageQuantity,
        },
      });
    }

    return sendResponse(
      res,
      200,
      "Package successfully created!",
      eventPackage
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  } finally {
    if (req.files && Array.isArray(req.files)) {
      (req.files as Express.Multer.File[]).forEach((file) => {
        const imageFilePath = path.resolve(file.path);
        if (fs.existsSync(imageFilePath)) {
          fs.unlinkSync(imageFilePath);
        }
      });
    }
  }
};

// Function to view a particular package
export const viewPackage = async (
  req: Request,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { packageId } = req.params;
    if (!packageId) {
      return ErrorHandler.notFound(res, "packageId not provided!");
    }

    const EventPackage = await PackageService.getPackageById(packageId);
    if (!EventPackage) {
      return ErrorHandler.notFound(res, "Event Package not found!");
    }

    // Create a new object with modified groupPrivacy
    const filteredEventPackage = {
      ...EventPackage.toObject(), // Ensure it's a plain object
      packageTitle: toTitleCase(EventPackage.packageTitle),
    };

    return sendResponse(
      res,
      200,
      "Event Package successfully fetched!",
      filteredEventPackage
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};

// Function to view all Packages by a user
export const viewAllPackages = async (
  req: Request,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { eventGroupId } = req.params;
    if (!eventGroupId) {
      return ErrorHandler.notFound(res, "Event GroupId not provided");
    }

    const eventPackages = await PackageService.getPackages({
      eventGroup: eventGroupId,
    });
    if (!eventPackages.length) {
      return sendResponse(res, 200, "No event packages found!", []);
    }

    // Ensure each eventPackage is converted to an object before modifying
    const filteredEventPackages = eventPackages.map((eventPackage) => ({
      ...eventPackage.toObject(), // Convert Mongoose document to plain object
      packageTitle: toTitleCase(eventPackage.packageTitle),
    }));

    return sendResponse(
      res,
      200,
      "Event Packages successfully fetched!",
      filteredEventPackages
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};

// Function to view all Packages by an admin
export const viewAllPackageByAdmin = async (
  req: Request,
  res: Response
): Promise<Response | undefined> => {
  try {
    const eventPackages = await PackageService.getPackages();
    if (!eventPackages.length) {
      return sendResponse(res, 200, "No event packages found!", []);
    }

    return sendResponse(
      res,
      200,
      "Event Packages successfully fetched!",
      eventPackages
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};

// Function to update an existing package
// export const updatePackage = async (req: OptionalAuthenticateRequest, res: Response): Promise<Response | undefined> => {
//     try {
//         const { error } = validateUpdatedPackage(req.body);
//         if (error) {
//           return ErrorHandler.badUserInput(res, error.details[0].message);
//         }

//         const { packageId } = req.params;
//         const { packageTitle, packageDescription, packagePriceCurrency, packagePrice, packageQuantity, packageDelivery } = req.body;

//         // Find the existing package
//         const existingPackage = await PackageService.getPackageById(packageId);
//         if (!existingPackage) {
//             return ErrorHandler.notFound(res, "Package not found!");
//         }

//         // Check if the new title already exists (excluding the current package)
//         if (packageTitle && packageTitle.toLowerCase() !== existingPackage.packageTitle) {
//             const titleExists = await PackageService.getPackageByField({ packageTitle: packageTitle.toLowerCase() });
//             if (titleExists) {
//                 return ErrorHandler.conflict(res, `Package title: ${packageTitle} already exists! Change it.`, { packageTitle });
//             }
//         }

//         let packageImgUrls = existingPackage.packageImgUrls;
//         let packageImgPublicIds = existingPackage.packageImgPublicIds;

//         // Handle new image uploads if present
//         if (req.files && Array.isArray(req.files) && req.files.length > 0) {
//             // Delete old images from Cloudinary
//             await Promise.all(existingPackage.packageImgPublicIds.map(async (publicId) => {
//                 await deleteImage(publicId); // Function to delete image from Cloudinary
//             }));

//         // Check MIME type for each file
//         for (const file of req.files) {
//               if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
//                 return ErrorHandler.badUserInput(res, "All images must be in JPEG or PNG format.");
//               }

//               if (file.size > 10 * 1024 * 1024) {
//                 return ErrorHandler.badUserInput(res, "Each image must not exceed 10MB in size.");
//               }
//         }

//             // Upload new images
//             const uploadedImages = await Promise.all(
//                 (req.files as Express.Multer.File[]).map(async (file) => {
//                     const imageFilePath = path.resolve(file.path);

//                     // Check if the file exists before proceeding
//                     if (!fs.existsSync(imageFilePath)) {
//                         throw new Error("Uploaded image not found");
//                     }

//                     // Upload image
//                     const uploadedImage = await uploadImage(imageFilePath);

//                     return uploadedImage;
//                 })
//             );

//             // Update with new image URLs & Public IDs
//             packageImgUrls = uploadedImages.map((img) => img.secure_url);
//             packageImgPublicIds = uploadedImages.map((img) => img.public_id);
//         }

//         let packageDeliveryArranged: string[] = [];

//         if (packageDelivery) {
//             const arrangeDelivery = packageDelivery.split(",").map((str: string) => str.trim());

//             let homeDeliveryCount = 0;

//             packageDeliveryArranged = arrangeDelivery.map((delivery: string) => {
//                 const [mainType, subType] = delivery.split(":").map(str => str.trim());

//                 if (mainType === "homeDelivery" && subType) {
//                     homeDeliveryCount++;
//                     if (homeDeliveryCount > 1) {
//                         throw new Error("Only one homeDelivery option (selfManaged or platformDelivery) can be selected.");
//                     }
//                     return `${mainType}:${subType}`;
//                 }

//                 return mainType; // Keep "pickUp" as it is
//             });

//         } else {
//             packageDeliveryArranged = ["pickUp"];
//         }

//         const packageData = {
//             packageTitle: packageTitle ? packageTitle.toLowerCase() : existingPackage.packageTitle,
//             packageDescription: packageDescription || existingPackage.packageDescription,
//             packagePriceCurrency: packagePriceCurrency || existingPackage.packagePriceCurrency,
//             packagePrice: packagePrice || existingPackage.packagePrice,
//             packageQuantity: packageQuantity || existingPackage.packageQuantity,
//             packageDelivery: packageDeliveryArranged || existingPackage.packageDelivery,
//             packageImgUrls,  // Updated image URLs
//             packageImgPublicIds,  // Updated Public IDs
//         }

//         // Update package details
//         const updatedPackage = await PackageService.updatePackageById(packageId, packageData, true);
//         if (!updatedPackage) {
//             return ErrorHandler.validationError(res, "Unable to update package data!");
//         }

//         const { userId, role } = req.user || {};
//         if (req.user && userId && role === 'cohost') {
//           // ✅ Log activity for updating Event Package
//           await ActivityLogService.logActivity({
//             user: userId,
//             event: (updatedPackage.eventGroup as IEventGroup).event._id,
//             action: "Updated a Package",
//             entity: toTitleCase(packageTitle || existingPackage.packageTitle),
//             entityType: toTitleCase((updatedPackage.eventGroup as IEventGroup).groupName),
//             meta: {
//               packageId: updatedPackage._id,
//               description: packageDescription || existingPackage.packageDescription || "NA",
//               price: packagePrice || existingPackage.packagePrice,
//               quantity: packageQuantity || existingPackage.packageQuantity,
//             },
//           });
//         }

//         return sendResponse(res, 200, "Package successfully updated!", updatedPackage);

//     } catch (error: unknown) {
//         if (error instanceof Error) {
//             return ErrorHandler.internalServerError(res, error.message);
//         }
//     } finally {
//         if (req.files && Array.isArray(req.files)) {
//           (req.files as Express.Multer.File[]).forEach((file) => {
//             const imageFilePath = path.resolve(file.path);
//             if (fs.existsSync(imageFilePath)) {
//               fs.unlinkSync(imageFilePath);
//             }
//           });
//         }
//       }
// };

export const updatePackage = async (req: OptionalAuthenticateRequest, res: Response): Promise<Response | undefined> => {
  try {
    const { error } = validateUpdatedPackage(req.body);
    if (error) {
      return ErrorHandler.badUserInput(res, error.details[0].message);
    }

    const { packageId } = req.params;
    const {
      packageTitle,
      packageDescription,
      packagePrice,
      packageQuantity,
      packageDelivery,
      publicIdsToReplace,
      packageSize,
      isDraft,
    } = req.body;

    // Find the existing package
    const existingPackage = await PackageService.getPackageById(packageId);
    if (!existingPackage) {
      return ErrorHandler.notFound(res, "Package not found!");
    }

    // Check if the new title already exists (excluding the current package)
    // if (packageTitle && packageTitle.toLowerCase() !== existingPackage.packageTitle) {
    //   const titleExists = await PackageService.getPackageByField({
    //     packageTitle: packageTitle.toLowerCase(),
    //   });
    //   if (titleExists) {
    //     return ErrorHandler.conflict(res, `Package title: ${packageTitle} already exists! Change it.`, { packageTitle });
    //   }
    // }

    let packageImgUrls = [...existingPackage.packageImgUrls];
    let packageImgPublicIds = [...existingPackage.packageImgPublicIds];

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      // Validate file types and size
      for (const file of req.files) {
        if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
          return ErrorHandler.badUserInput(res, "All images must be in JPEG or PNG format.");
        }
        if (file.size > 10 * 1024 * 1024) {
          return ErrorHandler.badUserInput(res, "Each image must not exceed 10MB in size.");
        }
      }

      // Parse the publicIdsToReplace as an array
      const publicIdsArray = publicIdsToReplace
        ? publicIdsToReplace.split(",").map((id: string) => id.trim())
        : [];

      if (publicIdsArray.length > 0) {
        if (publicIdsArray.length !== req.files.length) {
          return ErrorHandler.badUserInput(res, "The number of images provided must match the number of publicIds to replace.");
        }

        // Replace only the specified images
        for (let i = 0; i < publicIdsArray.length; i++) {
          const publicId = publicIdsArray[i];
          const file = req.files[i];

          const indexToReplace = packageImgPublicIds.indexOf(publicId);
          if (indexToReplace === -1) {
            return ErrorHandler.notFound(res, `The specified image with publicId '${publicId}' does not exist in this package.`);
          }

          // Delete the old image from Cloudinary
          await deleteImage(publicId);

          // Upload the new image
          const imageFilePath = path.resolve(file.path);
          if (!fs.existsSync(imageFilePath)) {
            throw new Error("Uploaded image not found");
          }

          const uploadedImage = await uploadImage(imageFilePath);

          // Replace the old image with the new one
          packageImgUrls[indexToReplace] = uploadedImage.secure_url;
          packageImgPublicIds[indexToReplace] = uploadedImage.public_id;
        }
      } else {
        return ErrorHandler.badUserInput(res, "No publicId(s) provided for replacement.");
      }
    }

    // let packageDeliveryArranged: string[] = [];

    // if (packageDelivery) {
    //   const arrangeDelivery = packageDelivery.split(",").map((str: string) => str.trim());

    //   let homeDeliveryCount = 0;

    //   packageDeliveryArranged = arrangeDelivery.map((delivery: string) => {
    //     const [mainType, subType] = delivery.split(":").map((str) => str.trim());

    //     if (mainType === "homeDelivery" && subType) {
    //       homeDeliveryCount++;
    //       if (homeDeliveryCount > 1) {
    //         throw new Error("Only one homeDelivery option (selfManaged or platformDelivery) can be selected.");
    //       }
    //       return `${mainType}:${subType}`;
    //     }

    //     return mainType; // Keep "pickUp" as it is
    //   });
    // } else {
    //   packageDeliveryArranged = ["pickUp"];
    // }

    let packageDeliveryArranged: string[] = [];

    console.log("Package Delivery: ", packageDelivery);

    const arrangeDelivery = packageDelivery
      .split(",")
      .map((str: string) => str.trim());

    // Validation: no duplicate delivery options
    const uniqueDelivery = new Set(arrangeDelivery);
    if (uniqueDelivery.size !== arrangeDelivery.length) {
      return ErrorHandler.badUserInput(res, "Duplicate delivery options are not allowed.");
    }

    // Validation: Only one of selfManaged or platformDelivery
    const hasSelfManaged = arrangeDelivery.includes("selfManaged");
    const hasPlatformDelivery = arrangeDelivery.includes("platformDelivery");

    if (hasSelfManaged && hasPlatformDelivery) {
      return ErrorHandler.badUserInput(res, "You cannot select both Self-delivery and Platform Delivery in the same package.");
    }

    // Validation: Platform Delivery disabled for dollar-based groups
    const eventGroup = await EventGroupService.getEventGroupById(existingPackage?.eventGroup as any);
    if (!eventGroup) {
      return ErrorHandler.notFound(res, "Event Group not found!");
    }
    if (eventGroup.groupCurrency === "USD" && hasPlatformDelivery) {
      return ErrorHandler.badUserInput(res, "Platform Delivery is not available for dollar-based groups.");
    }

    // Validate allowed options
    const allowedOptions = ["selfManaged", "platformDelivery", "pickUp"];
    for (const delivery of arrangeDelivery) {
      if (!allowedOptions.includes(delivery)) {
        return ErrorHandler.badUserInput(res, `Invalid delivery option: ${delivery}`);
      }
    }

    packageDeliveryArranged = arrangeDelivery;

    // Validate packageDelivery input
    if (!packageDelivery) {
      return ErrorHandler.badUserInput(res, "At least one delivery option must be selected.");
    }



    // // Remove duplicates
    // const uniqueDelivery = Array.from(new Set(packageDelivery));

    // // Only one of selfManaged or platformDelivery
    // const hasSelfManaged = uniqueDelivery.includes("selfManaged");
    // const hasPlatformDelivery = uniqueDelivery.includes("platformDelivery");

    // if (hasSelfManaged && hasPlatformDelivery) {
    //   return ErrorHandler.badUserInput(res, "You cannot select both Self-delivery and Platform Delivery in the same package.");
    // }

    // // Platform Delivery disabled for dollar-based groups
    // const eventGroup = await EventGroupService.getEventGroupById(existingPackage?.eventGroup as any);
    // if (!eventGroup) {
    //   return ErrorHandler.notFound(res, "Event Group not found!");
    // }

    // if (eventGroup.groupCurrency === "USD" && hasPlatformDelivery) {
    //   return ErrorHandler.badUserInput(res, "Platform Delivery is not available for dollar-based groups.");
    // }

    // // Validate allowed options
    // const allowedOptions = ["selfManaged", "platformDelivery", "pickUp"];
    // for (const delivery of uniqueDelivery) {
    //   if (!allowedOptions.includes(delivery)) {
    //     return ErrorHandler.badUserInput(res, `Invalid delivery option: ${delivery}`);
    //   }
    // }

    // packageDeliveryArranged = uniqueDelivery;

    // Update event flags
    const event = await EventService.getEventById((eventGroup as IEventGroup).event._id);
    if (!event) {
      return ErrorHandler.notFound(res, "Event not found!");
    }

    event.isPickUp = packageDeliveryArranged.includes("pickUp");
    event.isSelfManaged = packageDeliveryArranged.includes("selfManaged");
    event.isPlatformDelivery = packageDeliveryArranged.includes("platformDelivery");
    await event.save();

    const packageWeight = packageSizeWeight[packageSize as keyof typeof packageSizeWeight];

    const packageData = {
      packageTitle: packageTitle ? packageTitle.toLowerCase() : existingPackage.packageTitle,
      packageDescription: packageDescription || existingPackage.packageDescription,
      packagePrice: packagePrice || existingPackage.packagePrice,
      packageQuantity: packageQuantity || existingPackage.packageQuantity,
      packageDelivery: packageDeliveryArranged || existingPackage.packageDelivery,
      packageSize: packageWeight || existingPackage.packageSize,
      packageImgUrls,
      packageImgPublicIds,
      isDraft: false,
    };

    // Update package details
    const updatedPackage = await PackageService.updatePackageById(packageId, packageData, true);
    if (!updatedPackage) {
      return ErrorHandler.validationError(res, "Unable to update package data!");
    }

    const { userId, role } = req.user || {};
    if (req.user && userId && role === "cohost") {
      // ✅ Log activity for updating Event Package
      await ActivityLogService.logActivity({
        user: userId,
        event: (updatedPackage.eventGroup as IEventGroup).event._id,
        group: existingPackage.eventGroup._id.toString(),
        action: "Updated a Package",
        actionType: "Group",
        entity: toTitleCase(packageTitle || existingPackage.packageTitle),
        entityType: toTitleCase(
          (updatedPackage.eventGroup as IEventGroup).groupName
        ),
        meta: {
          eventGroupID: existingPackage.eventGroup._id,
          packageId: updatedPackage._id,
          description:
            packageDescription || existingPackage.packageDescription || "NA",
          price: packagePrice || existingPackage.packagePrice,
          quantity: packageQuantity || existingPackage.packageQuantity,
        },
      });
    }

    return sendResponse(res, 200, "Package successfully updated!", updatedPackage);

  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  } finally {
    if (req.files && Array.isArray(req.files)) {
      (req.files as Express.Multer.File[]).forEach((file) => {
        const imageFilePath = path.resolve(file.path);
        if (fs.existsSync(imageFilePath)) {
          fs.unlinkSync(imageFilePath);
        }
      });
    }
  }
};



// Function to delete a particular package
export const deletePackage = async (
  req: OptionalAuthenticateRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { groupId, packageId } = req.params;
    if (!packageId) {
      return ErrorHandler.notFound(res, "packageId not provided!");
    }

    // if (!groupId) {
    //     return ErrorHandler.notFound(res, "groupId not provided!")
    // }

    const eventPackage = await PackageService.getPackageById(packageId);
    if (!eventPackage) {
      return ErrorHandler.notFound(res, "Event Package not found!");
    }

    const deletedEventPackage = await PackageService.deletePackageById(
      packageId
    );
    if (!deletedEventPackage) {
      return ErrorHandler.validationError(
        res,
        "Unable to delete event package data!"
      );
    }

    // // Now we delete the referenced event package from Event group
    // const deleteEventPackageReference = await EventGroupService.removePackageFromEventGroup(groupId, packageId)
    // if (!deleteEventPackageReference) {
    //     return ErrorHandler.validationError(res, "Unable to delete event package data from Event group!");
    // }

    const { userId, role } = req.user || {};
    if (req.user && userId && role === "cohost") {
      // ✅ Log activity for updating Event Package
      await ActivityLogService.logActivity({
        user: userId,
        event: (deletedEventPackage.eventGroup as IEventGroup).event._id,
        group: eventPackage.eventGroup._id.toString(),
        action: "Deleted a Package",
        actionType: "Group",
        entity: toTitleCase(deletedEventPackage.packageTitle),
        entityType: toTitleCase(
          (deletedEventPackage.eventGroup as IEventGroup).groupName
        ),
        meta: {
          eventGroupID: eventPackage.eventGroup._id,
          packageId: deletedEventPackage._id,
          description: deletedEventPackage.packageDescription || "NA",
          price: deletedEventPackage.packagePrice,
          quantity: deletedEventPackage.packageQuantity,
        },
      });
    }

    return sendResponse(res, 200, "Event Package successfully deleted!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
};
