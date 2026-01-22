import { Request, Response } from "express";
import MessageService from "../services/messagingServices";
import { SmsLinkService } from "../services/smsLinkServices";
import { GuestTracking } from "../models/guestTrackingModel";
import { EventService, EventGroupService } from "../services/eventServices";
import { UserService } from "../services/userServices";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { formatEventDate, timeZoneMap, toTitleCase, validatePhoneNumber } from "../helpers/helpers";
import { IEventGroup, IGuestTracking, ISMSlink } from "../interfaces/modelInterface";
import ActivityLogService from "../services/activityLogService";
import { OptionalAuthenticateRequest } from "../middleware/optionalAuthenticate";
import { ValidationResult } from "../interfaces/interface";
import { AuthenticatedRequest } from "../middleware/authentication";
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import SUPPORTED_COUNTRIES from "../utils/supportedCountries";
import { DateTime } from "luxon";

const FRONTEND_URL = process.env.CLIENT_URL;

// const normalizePhoneNumber = (input: string): string | null => {
//     if (!input) return null;
  
//     // Match all substrings that contain digits or a plus sign
//     const matches = input.match(/(\+?\d[\d\s]*)/g);
//     if (!matches) return null;
  
//     for (let part of matches) {
//       // Remove all non-digit characters except +
//       let cleaned = part.replace(/[^\d+]/g, '');
  
//       // Handle Nigerian numbers
//       if (/^0\d{10}$/.test(cleaned)) return '+234' + cleaned.slice(1);        // 0810...
//       if (/^234\d{10}$/.test(cleaned)) return '+234' + cleaned.slice(3);      // 234810...
//       if (/^\d{10}$/.test(cleaned)) return '+234' + cleaned;                  // 810...
//       if (/^\+234\d{10}$/.test(cleaned)) return cleaned;                      // +234810...
  
//       // Handle valid international numbers like UK, US, etc.
//       if (/^\+\d{10,15}$/.test(cleaned)) return cleaned;
//     }
  
//     return null;
//   };       


// const SUPPORTED_COUNTRIES = ['NG', 'US', 'CA', 'GB', 'GH', 'KE', 'TZ', 'UG', 'ZA'];
// const SUPPORTED_COUNTRIES = SUPPORTED_COUNTRIES;


export const normalizePhoneNumber = (input: string): string | null => {
  if (!input) return null;

  // Match all substrings that contain digits or a plus sign
  const matches = input.match(/(\+?\d[\d\s\-().]*)/g);
  if (!matches) return null;

  for (let part of matches) {
    // Remove all non-digit characters except +
    let cleaned = part.replace(/[^\d+]/g, '');

    // ----------------------------
    // Nigerian number handling
    // ----------------------------
    if (/^0\d{10}$/.test(cleaned)) cleaned = '+234' + cleaned.slice(1);      // 0813...
    else if (/^234\d{10}$/.test(cleaned)) cleaned = '+234' + cleaned.slice(3); // 234813...
    else if (/^\d{10}$/.test(cleaned)) cleaned = '+234' + cleaned;            // 8130000000
    else if (/^\d{11}$/.test(cleaned) && cleaned.startsWith('234')) cleaned = '+' + cleaned; // 2348130000000
    else if (!cleaned.startsWith('+') && /^\d{10,15}$/.test(cleaned)) cleaned = '+' + cleaned; // 12059314203 or 447911123456

    // ----------------------------
    // Use libphonenumber-js for validation
    // ----------------------------
    const phoneNumber = parsePhoneNumberFromString(cleaned);

    if (phoneNumber?.isValid() && SUPPORTED_COUNTRIES.includes(phoneNumber.country!)) {
      return phoneNumber.number; // returns in E.164 format
    }
  }

  return null;
};
  

// Function to send messages (SMS or WhatsApp)
const sendInvites = async (req: OptionalAuthenticateRequest, res: Response, channel: "sms" | "whatsapp" | "both") => {
    try {
        const { eventGroupId, contacts } = req.body;
        if (!eventGroupId || !contacts || !Array.isArray(contacts)) {
            return ErrorHandler.validationError(res, "Event group ID and valid contacts are required.");
        }

        // Extract guest names and phone numbers
        const guestContacts = contacts.map(({ guestName, phoneNumber }) => ({
            guestName: guestName ? toTitleCase(guestName) : "Guest",
            phoneNumber: phoneNumber,
        }));

        // Fetch event details once
        const eventGroup: IEventGroup | null = await EventGroupService.getEventGroupById(eventGroupId);
        if (!eventGroup) {
            return ErrorHandler.notFound(res, "Event group not found.");
        }

        const { userId, role } = req.user || {};

        // // Fetch the Host details 
        // const host = await UserService.getUserByEmail(eventGroup.event.hostEmail);
        // if (!host) return ErrorHandler.notFound(res, "Host not found.");

        // const message = `You're invited! \nJoin us in celebrating ${eventGroup?.event?.eventName} on ${eventGroup?.event?.date} at ${eventGroup?.event?.eventLocation} at ${eventGroup?.event?.time}. \nYou can explore and purchase your curated Aso-Ebi package by clicking this link: `;
        const message = `You're invited! Join us in celebrating ${eventGroup?.event?.eventName} on ${eventGroup?.event?.date} at ${eventGroup?.event?.eventLocation} at ${eventGroup?.event?.time}. \nYou can explore and purchase your curated Aso-Ebi package by clicking this link: `;
        const whatsAppMessage = `Hello, you're invited to ${eventGroup?.event?.eventName}!\n📅 Date: ${eventGroup?.event?.date}\n⏰ Time: ${eventGroup?.event?.time}\n📍 Location: ${eventGroup?.event?.eventLocation}\nClick here: `;
        

        // ✅ Generate links asynchronously
        const trackingLinks = await Promise.all(
            guestContacts.map(async ({ guestName, phoneNumber }) => {
                const normalizedPhone = normalizePhoneNumber(phoneNumber);
        
                let formattedPhone: string | undefined;
                console.log("Normalized Phone:", normalizedPhone);

                // Validate phone number
                if (!normalizedPhone) {
                    throw new Error("Invalid phone number.");
                }
                const phoneValidationResult: ValidationResult = validatePhoneNumber(normalizedPhone);
                if (!phoneValidationResult.success) {
                  throw new Error(phoneValidationResult.message);
                } else {
                    formattedPhone = phoneValidationResult.phoneNumber;
                }

                const token = await SmsLinkService.generateSmsPreviewCode(eventGroup.event._id, eventGroup._id.toString(), formattedPhone as string);
                if (!token) {
                    throw new Error(`Failed to generate preview token for phone: ${formattedPhone}`);
                }                
                const link = `${FRONTEND_URL}/preview?code=${token}`;
                return { guestName, phoneNumber: formattedPhone, link };
            })
        );

        // Bulk insert guest tracking records
        // const savedGuestContacts: IGuestTracking[] = await GuestTracking.insertMany(trackingLinks.map(tracking => ({
        //     guestName: tracking.guestName,
        //     phoneNumber: tracking.phoneNumber as string,
        //     eventGroupId,
        //     inviteLink: tracking.link,
        //     sentAt: new Date(),
        // })));

        // Bulk insert guest tracking records
        const savedGuestContacts: IGuestTracking[] = [];
        const skippedGuests: { phoneNumber: string; reason: string }[] = [];

        for (const tracking of trackingLinks) {
            try {
            const existingGuest = await GuestTracking.findOne({ phoneNumber: tracking.phoneNumber, eventGroupId });

            // Check if guest has already viewed or ordered
            if (existingGuest && ["viewed", "ordered"].includes(existingGuest.status)) {
                // Skip guest and store reason
                skippedGuests.push({
                    phoneNumber: tracking.phoneNumber as string,
                    reason: `Guest has already ${existingGuest.status} the invite.`,
                });
                continue;
            }

            if (existingGuest) {
                // Update existing guest
                existingGuest.guestName = tracking.guestName;
                existingGuest.inviteLink = tracking.link;
                // existingGuest.sentAt = new Date();
                await existingGuest.save();
                savedGuestContacts.push(existingGuest);
            } else {
                // Insert new guest
                const newGuest = await GuestTracking.create({
                    guestName: tracking.guestName,
                    phoneNumber: tracking.phoneNumber,
                    eventGroupId,
                    eventId: eventGroup.event._id,
                    hostId: role === "host" ? userId : "",
                    inviteLink: tracking.link,
                    sentAt: new Date(),
                });
                savedGuestContacts.push(newGuest);
            }
        } catch (err: any) {
            skippedGuests.push({
                phoneNumber: tracking.phoneNumber as string,
                reason: `Error processing guest: ${err.message}`,
            });
        }
        }

        // savedGuestContacts.forEach(contact => eventGroup.contacts.push(contact));
        for (const contact of savedGuestContacts) {
            if (!eventGroup.contacts.some(c => c.phoneNumber === contact.phoneNumber)) {
                eventGroup.contacts.push(contact);
            }
        }        
        await eventGroup.save();

        // Send messages concurrently
        await Promise.all(
            trackingLinks.map(async tracking => {
                const messageToSend = `${message}${tracking.link}`;
                const whatsappMessageToSend = `${whatsAppMessage}${tracking.link}`;

                if (channel === "sms") {
                    return MessageService.sendSMSToGuestViaTermii(tracking.phoneNumber as string, messageToSend);
                } else if (channel === "whatsapp") {
                    // return MessageService.sendWhatsAppMessage(tracking.phoneNumber as string, whatsappMessageToSend);
                    return MessageService.sendWhatsAppMessageAPI(tracking.phoneNumber as string, whatsappMessageToSend);   
                } else {
                    // Send both messages
                    return Promise.all([
                        MessageService.sendSMSToGuestViaTermii(tracking.phoneNumber as string, messageToSend),
                        // MessageService.sendWhatsAppMessage(tracking.phoneNumber as string, whatsappMessageToSend),
                        MessageService.sendWhatsAppMessageAPI(tracking.phoneNumber as string, whatsappMessageToSend),
                    ]);
                }
            })
        );

        if (req.user && userId && role === 'cohost') {
            // ✅ Log activity for Imported contacts
            await ActivityLogService.logActivity({
                user: userId,
                event: eventGroup?.event?._id,
                group: eventGroup._id.toString(),
                action: "Import Contact",
                actionType: "Group",
                entity: toTitleCase(eventGroup.groupName),
                entityType: eventGroup.contacts.length > 1 ? `${eventGroup.contacts.length} Contacts` : `${eventGroup.contacts.length} Contact`,
                meta: {
                    eventGroupID: eventGroup._id,
                    description: eventGroup.groupDescription || "NA",
                },
            });
        }

        return sendResponse(res, 200, `Invitations sent via ${channel.toUpperCase()}`, trackingLinks, { skipped: skippedGuests, });

    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

// Expose the functions
export const sendInviteViaSMS = (req: Request, res: Response) => sendInvites(req, res, "sms");
export const sendInviteViaWhatsApp = (req: Request, res: Response) => sendInvites(req, res, "whatsapp");
export const sendInviteViaBoth = (req: Request, res: Response) => sendInvites(req, res, "both");



// Get event details and update view status
export const getInviteDetails = async (req: Request, res: Response) => {
    try {
        const { code } = req.query;

        if (!code) {
            return ErrorHandler.validationError(res, "Link is broken or missing");
        }

        const decryptedData: ISMSlink | null = await SmsLinkService.decodeSmsLink(code as string);
        if (!decryptedData) return ErrorHandler.validationError(res, "Invalid link");

        const { eventId, groupId, guestPhoneNumber } = decryptedData; 

        // Fetch event Group details
        const eventGroup: any = await EventGroupService.getEventGroupById(groupId.toString());
        if (!eventGroup) return ErrorHandler.notFound(res, "Event group not found.");
        if (eventGroup.isDisabled) return ErrorHandler.forbidden(res, "This group is not accepting payments at this time.");

        // Fetch event details
        const event: any = await EventService.getEventById(eventId.toString());
        if (!event) return ErrorHandler.notFound(res, "Event not found.");
        if (event.isDisabled) return ErrorHandler.forbidden(res, "This Event is not accepting payments at this time.");

        // if (Date.now() > new Date(event.date).getTime()) {
        //     return ErrorHandler.forbidden(res, "Sorry, this event has closed!");
        // }


        // Check if event has ended (1 day before event date) - USING EVENT TIMEZONE
        const timeZone = event.timeZone || "WAT";
        const zone = timeZoneMap[timeZone] || timeZoneMap["WAT"];
        
        // Parse the event date and time in the correct timezone
        const eventDateTime = DateTime.fromFormat(
            `${event.date} ${event.time}`, 
            "yyyy-MM-dd hh:mm a", 
            { zone }
        );

        if (!eventDateTime.isValid) {
            console.warn('Invalid event date/time format:', eventDateTime.invalidExplanation);
            return ErrorHandler.validationError(res, "Invalid event date/time format");
        }

        // Calculate 1 day before the event in the same timezone
        const oneDayBeforeEvent = eventDateTime.minus({ days: 1 });
        
        // Get current time in the event's timezone
        const now = DateTime.now().setZone(zone);

        // Check if current time is after the cutoff (1 day before event)
        if (now > oneDayBeforeEvent) {
            return ErrorHandler.forbidden(res, "Sorry, this event has closed!");
        }

        if (guestPhoneNumber) {
        // Find and update guest tracking record
        const guestTracking = await GuestTracking.findOneAndUpdate(
            { phoneNumber: guestPhoneNumber, eventGroupId: groupId },
            { hasViewed: true, status: "viewed", viewedAt: new Date() },
            { new: true }
        );

            // if (!guestTracking) {
            //     return ErrorHandler.notFound(res, "Invitation not found for this phone number.");
            // }
        }

        // Display Date and time 
        const displayDateAndTime = formatEventDate(event.date, event.time, (event.timeZone || "WAT"))

        return sendResponse(res, 200, "Invitation details retrieved and view status updated", { display_date_time: displayDateAndTime, event: event, eventGroup: eventGroup });

    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};




// Function to get the contacts of an Event Group
export const getEventGroupContacts = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user.userId;
        if (!userId) {
            return ErrorHandler.validationError(res, "User not logged in, please log in!.");
        }

        const { eventGroupId } = req.params;
        if (!eventGroupId) {
            return ErrorHandler.validationError(res, "Event group ID is required.");
        }

        // Fetch contact list for the Event group
        const guestContactList = await GuestTracking.find({ eventGroupId }).sort({ createdAt: -1 });
        if (guestContactList.length === 0) {
            return sendResponse(res, 200, "No contacts found for this Event group.", []);
        }
        
        // Send Response 
        return sendResponse(res, 200, "Contact list retrieved successfully", guestContactList);

    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};