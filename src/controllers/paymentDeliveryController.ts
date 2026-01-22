import { Request, Response } from "express";
import PaymentAndDeliveryService from "../services/paymentDeliveryServices";
import { UserService } from "../services/userServices";
import { EventGroupService, EventService, PackageService } from "../services/eventServices";
import { WithdrawalService } from "../services/withdrawalServices";
import PaymentService from "../services/paymentServices";
import { validatePaymentAndDelivery, validatePaymentAndDeliveryUpdate } from "../middleware/validator";
import { AuthenticatedRequest } from "../middleware/authentication";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { parseDateTime, validatePhoneNumber } from "../helpers/helpers";
import { INairaPayout, IDollarPayout, IPaymentAndDelivery, IPackage } from "../interfaces/modelInterface";
import mongoose from "mongoose";


// Normalize phone number
const normalizePhoneNumber = (phone?: string): string =>
  typeof phone === "string" && phone.startsWith("+") ? phone.slice(1) : phone || "";



class PaymentAndDeliveryController {
  /**
   * Create a new Payment and Delivery record
   */
  // static async create(req: AuthenticatedRequest, res: Response) {
  //   try {
  //     const userId = req.user?.userId; // Extract userId from authenticated request
  //     if (!userId) return ErrorHandler.unauthorized(res, "Unauthorized");

  //     const user = await UserService.getUserById(userId);
  //     if (!user) return ErrorHandler.notFound(res, "User not found");

  //     // Validate request body
  //     const { error } = validatePaymentAndDelivery(req.body);
  //     if (error) {
  //       return ErrorHandler.badUserInput(res, error.details[0].message);
  //     }

  //     // Request body for Naira Account
  //     const nairaAccount: any = req.body.accountNumber || req.body.bankName || req.body.accountName 
  //     ? {
  //       accountNumber: req.body.accountNumber,
  //       bankName: req.body.bankName,
  //       accountName: req.body.accountName,
  //     }
  //     : undefined;

  //     // Request body for Naira Account
  //     const dollarAccount: any = req.body.usAccountNumber || req.body.routingNumber || req.body.usBankName || req.body.usAccountName
  //     ? {
  //         usAccountNumber: req.body.usAccountNumber,
  //         routingNumber: req.body.routingNumber,
  //         usBankName: req.body.usBankName,
  //         usAccountName: req.body.usAccountName,
  //       }
  //     : undefined;
    

  //     // Destructure required fields
  //     const paymentBody: any = {
  //       event: req.body.event,
  //       paymentDate: req.body.paymentDate,
  //       paymentTime: req.body.paymentTime,
  //       paymentTimeZone: req.body.paymentTimeZone,
  //       contactName: req.body.contactName,
  //       contactPhoneNumber: req.body.contactPhoneNumber,
  //       pickupLocation: req.body.pickupLocation,
  //       deliveryDate: req.body.deliveryDate,
  //       deliveryTime: req.body.deliveryTime,
  //       deliveryTimeZone: req.body.deliveryTimeZone,
  //     };

  //     if (!paymentBody.event)
  //       return ErrorHandler.badUserInput(res, "Event ID is required");

  //     const eventDetails = await EventService.getEventById(paymentBody.event);
  //     if (!eventDetails) return ErrorHandler.notFound(res, "Event not found!");

  //     if (eventDetails.isNairaAccount) {
  //       paymentBody.nairaAccount = nairaAccount;
  //     }
      
  //     if (eventDetails.isDollarAccount) {
  //       paymentBody.dollarAccount = dollarAccount;
  //     }

  //     const phoneNumber = normalizePhoneNumber(paymentBody.contactPhoneNumber);

  //       // Validate phone number
  //       const phoneValidationResult = validatePhoneNumber(phoneNumber);
  //       if (!phoneValidationResult.success) {
  //         return ErrorHandler.badUserInput(res, phoneValidationResult.message, { phoneNumber });
  //       }

  //   // **Validate required payout details based on currency**
  //   if (eventDetails?.isNairaAccount && !nairaAccount) {
  //     return ErrorHandler.badUserInput(res, "Naira Payout Details are required!");
  //   }

  //   if (eventDetails?.isDollarAccount && !dollarAccount) {
  //     return ErrorHandler.badUserInput(res, "Dollar Payout Details are required!");
  //   }

  //   if (eventDetails?.isNairaAccount && eventDetails?.isDollarAccount) {
  //     if (!nairaAccount && !dollarAccount) {
  //       return ErrorHandler.badUserInput(res, "Naira and Dollar Payout Details are required!");
  //     }
  //   }

  //     // Create Payment & Delivery record
  //     const paymentAndDelivery =
  //       await PaymentAndDeliveryService.createPaymentAndDelivery({
  //         user: userId,
  //         event: paymentBody.event,
  //         nairaAccount: Object.keys(paymentBody.nairaAccount || {}).length ? paymentBody.nairaAccount : undefined,
  //         dollarAccount: Object.keys(paymentBody.dollarAccount || {}).length ? paymentBody.dollarAccount : undefined,          
  //         paymentDate: paymentBody.paymentDate,
  //         paymentTime: paymentBody.paymentTime,
  //         paymentTimeZone: paymentBody.paymentTimeZone,
  //         contactName: paymentBody.contactName,
  //         contactPhoneNumber: phoneNumber,
  //         pickupLocation: paymentBody.pickupLocation,
  //         deliveryDate: paymentBody.deliveryDate,
  //         deliveryTime: paymentBody.deliveryTime,
  //         deliveryTimeZone: paymentBody.deliveryTimeZone,
  //       });

  //     return sendResponse(res, 201, "Payment and Delivery record created successfully!", paymentAndDelivery);
  //   } catch (error: unknown) {
  //     if (error instanceof Error) {
  //       return ErrorHandler.internalServerError(res, error.message);
  //     }
  //   }
  // }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId; // Extract userId from authenticated request
      if (!userId) return ErrorHandler.unauthorized(res, "Unauthorized");
  
      const user = await UserService.getUserById(userId);
      if (!user) return ErrorHandler.notFound(res, "User not found");
  
      // Validate request body
      const { error } = validatePaymentAndDelivery(req.body);
      if (error) {
        return ErrorHandler.badUserInput(res, error.details[0].message);
      }
  
      // Request body for Naira Account (only include if at least one field is provided)
      const nairaAccount = req.body.nairaAccount && req.body.nairaAccount.accountNumber &&
                           req.body.nairaAccount.bankName && req.body.nairaAccount.accountName && req.body.nairaAccount.bankCode
        ? {
            accountNumber: req.body.nairaAccount.accountNumber.trim(),
            bankName: req.body.nairaAccount.bankName.trim(),
            accountName: req.body.nairaAccount.accountName.trim(),
            bankCode: req.body.nairaAccount.bankCode.trim(),
            recipientCode: "", // Add recipientCode as an optional property
      }
      : undefined;
  
      // Request body for Dollar Account (only include if at least one field is provided)
      const dollarAccount = req.body.dollarAccount && req.body.dollarAccount.usAccountNumber &&
                            req.body.dollarAccount.routingNumber && req.body.dollarAccount.usBankName &&
                            req.body.dollarAccount.usAccountName
      ? {
          usAccountNumber: req.body.dollarAccount.usAccountNumber.trim(),
          routingNumber: req.body.dollarAccount.routingNumber.trim(),
          usBankName: req.body.dollarAccount.usBankName.trim(),
          usAccountName: req.body.dollarAccount.usAccountName.trim(),
      }
      : undefined;

      // Destructure required fields
      const paymentBody: any = {
        event: req.body.event.trim(),
        paymentDate: req.body.paymentDate,
        paymentTime: req.body.paymentTime,
        paymentTimeZone: req.body.paymentTimeZone,
        contactName: req.body.contactName,
        contactPhoneNumber: req.body.contactPhoneNumber,
        pickupLocation: req.body.pickupLocation,
        pickupLatitude: req.body.pickupLatitude,
        pickupLongitude: req.body.pickupLongitude,
        state: req.body.state,
        city: req.body.city,
        deliveryDate: req.body.deliveryDate,
        deliveryTime: req.body.deliveryTime,
        deliveryTimeZone: req.body.deliveryTimeZone,
        isDraft: req.body.isDraft,
      };

      console.log("Payment & Delivery Body: ", req.body)
  
      if (!paymentBody.event)
        return ErrorHandler.badUserInput(res, "Event ID is required");

      if (!paymentBody.event || typeof paymentBody.event !== "string") {
        return ErrorHandler.badUserInput(res, "Event ID must be a valid string");
    }

      const existingPaymentDetails = await PaymentAndDeliveryService.getOneByField({event: paymentBody.event});
      if (existingPaymentDetails) return ErrorHandler.conflict(res, "Payment details already exists for this event!")
  
      const eventDetails = await EventService.getEventById(paymentBody.event);
      if (!eventDetails) return ErrorHandler.notFound(res, "Event not found!");

      if (paymentBody.isDraft && typeof paymentBody.isDraft !== "boolean") {
        return ErrorHandler.badUserInput(res, "User can only input true or false for isDraft!");
      }

      // if (eventDetails.isPickUp || eventDetails.isPlatformDelivery) {
      //   return ErrorHandler.badUserInput(res, "Pick up details are required! [contact name, contact phone number, pickup location, delivery time, delivery date and delivery time zone]")
      // }
      const requiredFields = [
        req.body.contactName,
        req.body.contactPhoneNumber,
        req.body.pickupLocation,
        req.body.deliveryDate,
        req.body.deliveryTime,
        req.body.deliveryTimeZone,
      ];

// If it's a pickup or platform delivery and any required field is missing or empty
if (
  (eventDetails.isPickUp || eventDetails.isPlatformDelivery) &&
  requiredFields.some((field) => !field || field.toString().trim() === "")
) {
  return ErrorHandler.badUserInput(
    res,
    "Pick up details are required! [contact name, contact phone number, pickup location, delivery time, delivery date and delivery time zone]"
  );
}

const restrictedStatesForPlatformDelivery = ["Lagos", "Oyo", "Abuja", "Osun", "Ogun"];

// Get all eventGroups for this event
const eventGroups = await EventGroupService.getEventGroups({event: paymentBody.event});
if (!eventGroups || eventGroups.length === 0) {
  return ErrorHandler.notFound(res, "No event groups found for this event!");
}

// Get all packages under these eventGroups
const packages: IPackage[] = [];
for (const eg of eventGroups) {
  const pkgs = await PackageService.getPackages({eventGroup: eg._id.toString()});
  packages.push(...pkgs);
}

// Normalize packageDelivery and check for platformDelivery
const hasPlatformDelivery = packages.some(pkg => {
  return pkg.packageDelivery.some(delivery => {
    const normalized = delivery.includes(":") ? delivery.split(":")[1].trim() : delivery;
    return normalized === "platformDelivery";
  });
});


// Pickup details validation
if ((eventDetails.isPickUp || eventDetails.isPlatformDelivery)) {
  if (!paymentBody.state || !paymentBody.city) {
    return ErrorHandler.badUserInput(res, "State and City are required for pickup details.");
  }

  // // Info modal logic
  // if (hasPlatformDelivery) {
  //   if (restrictedStatesForPlatformDelivery.includes(paymentBody.state)) {
  //     // Show info modal: remote areas in this state may not be covered
  //     // Frontend can handle this via response metadata
  //     return sendResponse(res, 200, "Some of your guest addresses may fall outside our delivery partner’s coverage.", { showInfoModal: true });
  //   } else {
  //     // State outside covered states
  //     return ErrorHandler.badUserInput(res, `We are currently unable to cover ${paymentBody.state}`);
  //   }
  // }
}

      const paymentDateTime = parseDateTime(paymentBody.paymentDate, paymentBody.paymentTime);
      const deliveryDateTime = parseDateTime(paymentBody.deliveryDate, paymentBody.deliveryTime);
      const eventDateTime = parseDateTime(eventDetails.date, eventDetails.time);

      console.log("Event Date: ", eventDateTime)
      console.log("Payment Date: ", paymentDateTime)
      console.log("Delivery Date: ", deliveryDateTime)

      if (req.body.paymentDate && req.body.paymentTime && paymentDateTime && eventDateTime && paymentDateTime.getTime() > eventDateTime.getTime()) {
          return ErrorHandler.validationError(res, "Payment Date Deadline must be before Event Date!");
      }

      if (paymentDateTime && paymentDateTime.getTime() < new Date().getTime()) {
        return ErrorHandler.validationError(res, "Payment Date Deadline cannot be in the past!");
      }

      if (req.body.deliveryDate && req.body.deliveryTime && deliveryDateTime && eventDateTime && deliveryDateTime.getTime() > eventDateTime.getTime()) {
          return ErrorHandler.validationError(res, "Delivery Date must be before Event Date!");
        }

      if (deliveryDateTime && deliveryDateTime.getTime() < new Date().getTime()) {
        return ErrorHandler.validationError(res, "Delivery Date cannot be in the past!");
      }

  
      // Include nairaAccount and dollarAccount only if eventDetails requires them and they have valid data
      if (eventDetails.isNairaAccount && nairaAccount) {
        paymentBody.nairaAccount = nairaAccount;
      }
  
      if (eventDetails.isDollarAccount && dollarAccount) {
        paymentBody.dollarAccount = dollarAccount;
      }
  
      let phoneNumber = paymentBody.contactPhoneNumber;

      if (eventDetails.isSelfManaged && !eventDetails.isPickUp && !eventDetails.isPlatformDelivery) {
        phoneNumber = normalizePhoneNumber(paymentBody.contactPhoneNumber);
  
        // Validate phone number
       // if (!phoneNumber) {
         // return ErrorHandler.badUserInput(res, "Contact phone number is required");
      //  }
  
        const phoneValidationResult = validatePhoneNumber(phoneNumber);
        if (!phoneValidationResult.success) {
          return ErrorHandler.badUserInput(res, phoneValidationResult.message, { phoneNumber });
        }
      }
  
      // Validate required payout details based on currency
      if (eventDetails?.isNairaAccount && !nairaAccount) {
        return ErrorHandler.badUserInput(res, "Naira Payout Details are required!");
      }
  
      if (eventDetails?.isDollarAccount && !dollarAccount) {
        return ErrorHandler.badUserInput(res, "Dollar Payout Details are required!");
      }
  
      if (eventDetails?.isNairaAccount && eventDetails?.isDollarAccount) {
        if (!nairaAccount && !dollarAccount) {
          return ErrorHandler.badUserInput(res, "Naira and Dollar Payout Details are required!");
        }
      }

      // Validate bank account details and create recipient code if nairaAccount is provided
      if (eventDetails?.isNairaAccount && nairaAccount) {
        // Validate account number only if nairaAccount is provided
        const result = await PaymentService.validateBankAccount(
            nairaAccount.accountNumber,
            nairaAccount.bankCode
        );
    
        if (!result?.data || !result.data.account_name || !result.data.account_number) {
            return ErrorHandler.badUserInput(res, "Invalid bank account details provided.");
        }
    
        // Generate recipient code
        const recipientCode = await WithdrawalService.createRecipient(
            result.data.account_name,
            result.data.account_number,
            nairaAccount.bankCode,
            eventDetails.hostEmail
        );
    
        // Assign recipientCode to nairaAccount
        nairaAccount.recipientCode = recipientCode;
    }    
  
      // Create Payment & Delivery record
      const paymentAndDelivery = await PaymentAndDeliveryService.createPaymentAndDelivery({
        user: userId,
        event: new mongoose.Types.ObjectId(req.body.event.trim()),
        ...(paymentBody.nairaAccount && { nairaAccount: paymentBody.nairaAccount }),
        ...(paymentBody.dollarAccount && { dollarAccount: paymentBody.dollarAccount }),
        paymentDate: paymentBody.paymentDate,
        paymentTime: paymentBody.paymentTime,
        paymentTimeZone: paymentBody.paymentTimeZone,
        contactName: paymentBody.contactName,
        contactPhoneNumber: phoneNumber ?? paymentBody.contactPhoneNumber,
        pickupLocation: paymentBody.pickupLocation,
        pickupLatitude: paymentBody.pickupLatitude,
        pickupLongitude: paymentBody.pickupLongitude,
        state: paymentBody.state,
        city: paymentBody.city,
        deliveryDate: paymentBody.deliveryDate,
        deliveryTime: paymentBody.deliveryTime,
        deliveryTimeZone: paymentBody.deliveryTimeZone,
        isDraft: paymentBody.isDraft,
      });
  
      return sendResponse(res, 201, "Payment and Delivery record created successfully!", paymentAndDelivery);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return ErrorHandler.internalServerError(res, error.message);
      }
    }
  }



  /**
   * Get a single Payment and Delivery record by ID
   */
  static async getOneById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const paymentAndDelivery = await PaymentAndDeliveryService.getOneById(id);

      if (!paymentAndDelivery)
        return ErrorHandler.notFound(res, "Record not found");

      return sendResponse(
        res,
        200,
        "Payment and Delivery record retrieved successfully!",
        paymentAndDelivery
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        return ErrorHandler.internalServerError(res, error.message);
      }
    }
  }


  // Get a single Payment and Delivery record by Event ID
  static async getOneByEventId(req: AuthenticatedRequest, res: Response) {
    try {
      const { eventId } = req.params;
      const paymentAndDelivery = await PaymentAndDeliveryService.getOneByField({ event: new mongoose.Types.ObjectId(eventId) });

      if (!paymentAndDelivery) return ErrorHandler.notFound(res, "Record not found");

      return sendResponse(res, 200, "Payment and Delivery record retrieved successfully!", paymentAndDelivery);

    } catch (error: unknown) {
      if (error instanceof Error) {
        return ErrorHandler.internalServerError(res, error.message);
      }
    }
  }



  /**
   * Get all Payment and Delivery records for a user
   */
  static async getAllByUser(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return ErrorHandler.unauthorized(res, "Unauthorized");

      const records = await PaymentAndDeliveryService.getAllByUser(userId);
      if (!records || records.length === 0)
        return ErrorHandler.notFound(
          res,
          "User payment and delivery records not found"
        );

      return sendResponse(
        res,
        200,
        "Payment and Delivery record retrieved successfully!",
        records
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        return ErrorHandler.internalServerError(res, error.message);
      }
    }
  }



/**
 * Update a Payment and Delivery record by ID (Dynamic Fields)
 */
// static async updateById(req: AuthenticatedRequest, res: Response) {
//   try {
//     const userId = req.user?.userId;
//     if (!userId) return ErrorHandler.unauthorized(res, "Unauthorized");

//     const { id } = req.params;

//     // Fetch existing record
//     const existingRecord = await PaymentAndDeliveryService.getOneById(id);
//     if (!existingRecord) return ErrorHandler.notFound(res, "Record not found");

//     // Validate request body
//     const { error } = validatePaymentAndDelivery(req.body);
//     if (error) {
//       return ErrorHandler.badUserInput(res, error.details[0].message);
//     }

//     // Ensure the user updating the record is the original creator
//     if (!existingRecord.user || existingRecord.user.toString() !== userId) {
//       return ErrorHandler.forbidden(res, "You are not authorized to update this record");
//     }

//     // Request body for Naira Account (only if provided)
//     const nairaAccount =
//       req.body.nairaAccount && req.body.nairaAccount.accountNumber &&
//       req.body.nairaAccount.bankName && req.body.nairaAccount.accountName
//         ? {
//             accountNumber: req.body.nairaAccount.accountNumber.trim(),
//             bankName: req.body.nairaAccount.bankName.trim(),
//             accountName: req.body.nairaAccount.accountName.trim(),
//           }
//         : existingRecord.nairaAccount;

//     // Request body for Dollar Account (only if provided)
//     const dollarAccount =
//       req.body.dollarAccount && req.body.dollarAccount.usAccountNumber &&
//       req.body.dollarAccount.routingNumber && req.body.dollarAccount.usBankName &&
//       req.body.dollarAccount.usAccountName
//         ? {
//             usAccountNumber: req.body.dollarAccount.usAccountNumber.trim(),
//             routingNumber: req.body.dollarAccount.routingNumber.trim(),
//             usBankName: req.body.dollarAccount.usBankName.trim(),
//             usAccountName: req.body.dollarAccount.usAccountName.trim(),
//           }
//         : existingRecord.dollarAccount;

//     // Validate and normalize phone number
//     const phoneNumber: string  | undefined = req.body.contactPhoneNumber
//       ? normalizePhoneNumber(req.body.contactPhoneNumber)
//       : existingRecord.contactPhoneNumber;

//     if (!phoneNumber) {
//       return ErrorHandler.badUserInput(res, "Contact phone number is required");
//     }

//     const phoneValidationResult = validatePhoneNumber(phoneNumber);
//     if (!phoneValidationResult.success) {
//       return ErrorHandler.badUserInput(res, phoneValidationResult.message, { phoneNumber });
//     }

//     // Fetch event details
//     if (!existingRecord.event) {
//       return ErrorHandler.badUserInput(res, "Event ID is required");
//     }
//     const eventDetails = await EventService.getEventById(existingRecord.event.toString());
//     if (!eventDetails) return ErrorHandler.notFound(res, "Event not found!");

//     // Ensure required payout details are provided based on the event settings
//     if (eventDetails.isNairaAccount && !nairaAccount) {
//       return ErrorHandler.badUserInput(res, "Naira Payout Details are required!");
//     }

//     if (eventDetails.isDollarAccount && !dollarAccount) {
//       return ErrorHandler.badUserInput(res, "Dollar Payout Details are required!");
//     }

//     if (eventDetails.isNairaAccount && eventDetails.isDollarAccount) {
//       if (!nairaAccount && !dollarAccount) {
//         return ErrorHandler.badUserInput(res, "Naira and Dollar Payout Details are required!");
//       }
//     }

//     // Prepare update fields
//     const updates = {
//       paymentDate: req.body.paymentDate || existingRecord.paymentDate,
//       paymentTime: req.body.paymentTime || existingRecord.paymentTime,
//       paymentTimeZone: req.body.paymentTimeZone || existingRecord.paymentTimeZone,
//       contactName: req.body.contactName || existingRecord.contactName,
//       contactPhoneNumber: phoneNumber,
//       pickupLocation: req.body.pickupLocation || existingRecord.pickupLocation,
//       pickupLatitude: req.body.pickupLatitude || existingRecord.pickupLatitude,
//       pickupLongitude: req.body.pickupLongitude || existingRecord.pickupLongitude,
//       deliveryDate: req.body.deliveryDate || existingRecord.deliveryDate,
//       deliveryTime: req.body.deliveryTime || existingRecord.deliveryTime,
//       deliveryTimeZone: req.body.deliveryTimeZone || existingRecord.deliveryTimeZone,
//       ...(nairaAccount && { nairaAccount }),
//       ...(dollarAccount && { dollarAccount }),
//       isDraft: false,
//     };

//     // Update the record
//     const updatedRecord = await PaymentAndDeliveryService.updateById(id, updates as any);
//     if (!updatedRecord) {
//       return ErrorHandler.validationError(res, "Unable to update the payment and delivery record!");
//     }

//     return sendResponse(res, 200, "Payment and Delivery record updated successfully!", updatedRecord);
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       return ErrorHandler.internalServerError(res, error.message);
//     }
//   }
// }


// // Function to update / create a new Payment and Delivery Record 
// static async updateById(req: AuthenticatedRequest, res: Response) {
//   try {
//     const userId = req.user?.userId;
//     if (!userId) return ErrorHandler.unauthorized(res, "Unauthorized");

//     const { eventId } = req.params;
//     const event = await EventService.getEventById(eventId);
//     if (!event) return ErrorHandler.notFound(res, "Event not found");

//     // Validate body (optional fields still need correct structure)
//     const { error } = validatePaymentAndDeliveryUpdate(req.body);
//     if (error) return ErrorHandler.badUserInput(res, error.details[0].message);

//     // Build Naira account
//     const naira = req.body.nairaAccount;
//     const nairaAccount =
//       naira?.accountNumber && naira?.bankName && naira?.accountName
//         ? {
//             accountNumber: naira.accountNumber.trim(),
//             bankName: naira.bankName.trim(),
//             accountName: naira.accountName.trim(),
//             bankCode: naira.bankCode.trim(),
//           }
//         : undefined;

//     // Build Dollar account
//     const dollar = req.body.dollarAccount;
//     const dollarAccount =
//       dollar?.usAccountNumber && dollar?.routingNumber && dollar?.usBankName && dollar?.usAccountName
//         ? {
//             usAccountNumber: dollar.usAccountNumber.trim(),
//             routingNumber: dollar.routingNumber.trim(),
//             usBankName: dollar.usBankName.trim(),
//             usAccountName: dollar.usAccountName.trim(),
//           }
//         : undefined;

//     // Check for existing record
//     const existingRecord = await PaymentAndDeliveryService.getOneByField({ event: new mongoose.Types.ObjectId(eventId) });

//     // Normalize phone number early
//     const normalizedPhone = req.body.contactPhoneNumber
//       ? normalizePhoneNumber(req.body.contactPhoneNumber)
//       : existingRecord?.contactPhoneNumber;

// const paymentDateTime = parseDateTime(
//   req.body.paymentDate || existingRecord?.paymentDate,
//   req.body.paymentTime || existingRecord?.paymentTime
// );

// const deliveryDateTime = parseDateTime(
//   req.body.deliveryDate || existingRecord?.deliveryDate,
//   req.body.deliveryTime || existingRecord?.deliveryTime
// );

// const eventDateTime = parseDateTime(event.date, event.time);

// // Check payment deadline vs event date
// if (
//   req.body.paymentDate &&
//   req.body.paymentTime &&
//   paymentDateTime &&
//   eventDateTime &&
//   paymentDateTime.getTime() > eventDateTime.getTime()
// ) {
//   return ErrorHandler.validationError(res, "Payment Date Deadline must be before Event Date!");
// }

// // Check delivery deadline vs payment deadline
// if (
//   req.body.deliveryDate &&
//   req.body.deliveryTime &&
//   req.body.paymentDate &&
//   req.body.paymentTime &&
//   deliveryDateTime &&
//   paymentDateTime &&
//   deliveryDateTime.getTime() < paymentDateTime.getTime()
// ) {
//   return ErrorHandler.validationError(res, "Delivery Date must be after payment deadline!");
// }



//     if (!existingRecord) {
//       // Create new
//       const newRecord = await PaymentAndDeliveryService.createPaymentAndDelivery({
//         event: eventId,
//         user: userId,
//         paymentDate: req.body.paymentDate,
//         paymentTime: req.body.paymentTime,
//         paymentTimeZone: req.body.paymentTimeZone,
//         contactName: req.body.contactName,
//         contactPhoneNumber: normalizedPhone,
//         pickupLocation: req.body.pickupLocation,
//         pickupLatitude: req.body.pickupLatitude,
//         pickupLongitude: req.body.pickupLongitude,
//         deliveryDate: req.body.deliveryDate,
//         deliveryTime: req.body.deliveryTime,
//         deliveryTimeZone: req.body.deliveryTimeZone,
//         nairaAccount,
//         dollarAccount,
//         isDraft: false
//       });
//       return sendResponse(res, 201, "Payment and Delivery record created successfully!", newRecord);
//     }

//     // Check role before updating
//     if (req.user?.role !== "host") {
//       return ErrorHandler.forbidden(res, "You are not authorized to update this record");
//     }

//     // Prepare update object
//     const updates: any = {
//       paymentDate: req.body.paymentDate ?? existingRecord.paymentDate,
//       paymentTime: req.body.paymentTime ?? existingRecord.paymentTime,
//       paymentTimeZone: req.body.paymentTimeZone ?? existingRecord.paymentTimeZone,
//       contactName: req.body.contactName ?? existingRecord.contactName,
//       contactPhoneNumber: normalizedPhone ?? existingRecord.contactPhoneNumber,
//       pickupLocation: req.body.pickupLocation ?? existingRecord.pickupLocation,
//       pickupLatitude: req.body.pickupLatitude ?? existingRecord.pickupLatitude,
//       pickupLongitude: req.body.pickupLongitude ?? existingRecord.pickupLongitude,
//       deliveryDate: req.body.deliveryDate ?? existingRecord.deliveryDate,
//       deliveryTime: req.body.deliveryTime ?? existingRecord.deliveryTime,
//       deliveryTimeZone: req.body.deliveryTimeZone ?? existingRecord.deliveryTimeZone,
//       isDraft: false,
//       ...(nairaAccount && { nairaAccount }),
//       ...(dollarAccount && { dollarAccount }),
//     };

//     const updatedRecord = await PaymentAndDeliveryService.updateById(existingRecord._id.toString(), updates);
//     if (!updatedRecord) {
//       return ErrorHandler.validationError(res, "Unable to update the payment and delivery record");
//     }

//     return sendResponse(res, 200, "Payment and Delivery record updated successfully!", updatedRecord);
//   } catch (error) {
//     return ErrorHandler.internalServerError(res, error instanceof Error ? error.message : "Unexpected error");
//   }
// }

static async updateById(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return ErrorHandler.unauthorized(res, "Unauthorized");

    const { eventId } = req.params;

    // Fetch event
    const event = await EventService.getEventById(eventId);
    if (!event) return ErrorHandler.notFound(res, "Event not found");

    // Validate request body
    const { error } = validatePaymentAndDeliveryUpdate(req.body);
    if (error) return ErrorHandler.badUserInput(res, error.details[0].message);

    // Destructure request body for easier access
    const {
      nairaAccount: naira,
      dollarAccount: dollar,
      paymentDate,
      paymentTime,
      paymentTimeZone,
      contactName,
      contactPhoneNumber,
      pickupLocation,
      pickupLatitude,
      pickupLongitude,
      state,
      city,
      deliveryDate,
      deliveryTime,
      deliveryTimeZone,
    } = req.body;

    // Normalize & prepare fields
    const nairaAccount = naira?.accountNumber && naira?.bankName && naira?.accountName
      ? {
          accountNumber: naira.accountNumber.trim(),
          bankName: naira.bankName.trim(),
          accountName: naira.accountName.trim(),
          bankCode: naira.bankCode.trim(),
        }
      : undefined;

    const dollarAccount = dollar?.usAccountNumber && dollar?.routingNumber && dollar?.usBankName && dollar?.usAccountName
      ? {
          usAccountNumber: dollar.usAccountNumber.trim(),
          routingNumber: dollar.routingNumber.trim(),
          usBankName: dollar.usBankName.trim(),
          usAccountName: dollar.usAccountName.trim(),
        }
      : undefined;

    const normalizedPhone = contactPhoneNumber ? normalizePhoneNumber(contactPhoneNumber) : undefined;

    // Fetch existing record
    const existingRecord = await PaymentAndDeliveryService.getOneByField({ event: new mongoose.Types.ObjectId(eventId) });

    // Parse datetime fields
    const paymentDateTime = parseDateTime(paymentDate || existingRecord?.paymentDate, paymentTime || existingRecord?.paymentTime);
    const deliveryDateTime = parseDateTime(deliveryDate || existingRecord?.deliveryDate, deliveryTime || existingRecord?.deliveryTime);
    const eventDateTime = parseDateTime(event?.date, event?.time);

    // Validate deadlines
    if (paymentDate && paymentTime && paymentDateTime && eventDateTime && paymentDateTime.getTime() > eventDateTime.getTime()) {
      return ErrorHandler.validationError(res, "Payment Date Deadline must be before Event Date!");
    }

    if (paymentDate && paymentTime && paymentDateTime && paymentDateTime.getTime() < new Date().getTime()) {
      return ErrorHandler.validationError(res, "Payment Date Deadline cannot be in the past!");
    }

    if (req.body.deliveryDate && req.body.deliveryTime && deliveryDateTime && eventDateTime && deliveryDateTime.getTime() > eventDateTime.getTime()) {
          return ErrorHandler.validationError(res, "Delivery Date must be before Event Date!");
        }

    if (deliveryDate && deliveryTime && deliveryDateTime && deliveryDateTime.getTime() < new Date().getTime()) {
      return ErrorHandler.validationError(res, "Delivery Date cannot be in the past!");
    }

    if (event.eventGroups.length === 0) {
      return ErrorHandler.validationError(res, "Create an Event group before adding Payment and Delivery details!")
    }

    if (!existingRecord) {
      // Create new record
      const newRecord = await PaymentAndDeliveryService.createPaymentAndDelivery({
        event: eventId,
        user: userId,
        paymentDate,
        paymentTime,
        paymentTimeZone,
        contactName,
        contactPhoneNumber: normalizedPhone,
        pickupLocation,
        pickupLatitude,
        pickupLongitude,
        state, 
        city,
        deliveryDate,
        deliveryTime,
        deliveryTimeZone,
        nairaAccount,
        dollarAccount,
        isDraft: false,
      });

      return sendResponse(res, 201, "Payment and Delivery record created successfully!", newRecord);
    }

    // Only allow host to update
    if (req.user?.role !== "host") {
      return ErrorHandler.forbidden(res, "You are not authorized to update this record");
    }

    // state: paymentBody.state,
    // city: paymentBody.city,

    // Build update object dynamically
    const updates: any = {
      isDraft: false,
      ...(paymentDate && { paymentDate }),
      ...(paymentTime && { paymentTime }),
      ...(paymentTimeZone && { paymentTimeZone }),
      ...(contactName && { contactName }),
      ...(normalizedPhone && { contactPhoneNumber: normalizedPhone }),
      ...(pickupLocation && { pickupLocation }),
      ...(pickupLatitude && { pickupLatitude }),
      ...(pickupLongitude && { pickupLongitude }),
      ...(state && { state }), 
      ...(city && { city }), 
      ...(deliveryDate && { deliveryDate }),
      ...(deliveryTime && { deliveryTime }),
      ...(deliveryTimeZone && { deliveryTimeZone }),
      ...(nairaAccount && { nairaAccount }),
      ...(dollarAccount && { dollarAccount }),
    };

    const updatedRecord = await PaymentAndDeliveryService.updateById(existingRecord._id.toString(), updates);
    if (!updatedRecord) {
      return ErrorHandler.validationError(res, "Unable to update the payment and delivery record");
    }

    return sendResponse(res, 200, "Payment and Delivery record updated successfully!", updatedRecord);
  } catch (error) {
    return ErrorHandler.internalServerError(res, error instanceof Error ? error.message : "Unexpected error");
  }
}




  /**
   * Delete a Payment and Delivery record by ID
   */
  static async deleteById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const deletedRecord = await PaymentAndDeliveryService.deleteById(id);

      if (!deletedRecord) return ErrorHandler.notFound(res, "Record not found");

      return sendResponse(
        res,
        200,
        "Payment and Delivery record deleted successfully!"
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        return ErrorHandler.internalServerError(res, error.message);
      }
    }
  }


// static async paymentSetupSaveForLater (req: AuthenticatedRequest, res: Response) {
//   try {
//     const userId = req.user?.userId; // Extract userId from authenticated request
//       if (!userId) return ErrorHandler.unauthorized(res, "Unauthorized");
  
//       const user = await UserService.getUserById(userId);
//       if (!user) return ErrorHandler.notFound(res, "User not found");
  
//       // Validate request body
//       const { error } = validatePaymentAndDelivery(req.body);
//       if (error) {
//         return ErrorHandler.badUserInput(res, error.details[0].message);
//       }
  
//       // Request body for Naira Account (only include if at least one field is provided)
//       const nairaAccount = req.body.nairaAccount && req.body.nairaAccount.accountNumber &&
//                            req.body.nairaAccount.bankName && req.body.nairaAccount.accountName && req.body.nairaAccount.bankCode
//         ? {
//             accountNumber: req.body.nairaAccount.accountNumber.trim(),
//             bankName: req.body.nairaAccount.bankName.trim(),
//             accountName: req.body.nairaAccount.accountName.trim(),
//             bankCode: req.body.nairaAccount.bankCode.trim(),
//             recipientCode: "", // Add recipientCode as an optional property
//       }
//       : undefined;
  
//       // Request body for Dollar Account (only include if at least one field is provided)
//       const dollarAccount = req.body.dollarAccount && req.body.dollarAccount.usAccountNumber &&
//                             req.body.dollarAccount.routingNumber && req.body.dollarAccount.usBankName &&
//                             req.body.dollarAccount.usAccountName
//       ? {
//           usAccountNumber: req.body.dollarAccount.usAccountNumber.trim(),
//           routingNumber: req.body.dollarAccount.routingNumber.trim(),
//           usBankName: req.body.dollarAccount.usBankName.trim(),
//           usAccountName: req.body.dollarAccount.usAccountName.trim(),
//       }
//       : undefined;

//       // Destructure required fields
//       const paymentBody: any = {
//         event: req.body.event.trim(),
//         paymentDate: req.body.paymentDate,
//         paymentTime: req.body.paymentTime,
//         paymentTimeZone: req.body.paymentTimeZone,
//       };
  
//       if (!paymentBody.event)
//         return ErrorHandler.badUserInput(res, "Event ID is required");

//       if (!paymentBody.event || typeof paymentBody.event !== "string") {
//         return ErrorHandler.badUserInput(res, "Event ID must be a valid string");
//     }

//       const existingPaymentDetails = await PaymentAndDeliveryService.getOneByField({event: paymentBody.event});
//       if (existingPaymentDetails) return ErrorHandler.conflict(res, "Payment details already exists for this event!")
  
//       const eventDetails = await EventService.getEventById(paymentBody.event);
//       if (!eventDetails) return ErrorHandler.notFound(res, "Event not found!");
  
//       // Include nairaAccount and dollarAccount only if eventDetails requires them and they have valid data
//       if (eventDetails.isNairaAccount && nairaAccount) {
//         paymentBody.nairaAccount = nairaAccount;
//       }
  
//       if (eventDetails.isDollarAccount && dollarAccount) {
//         paymentBody.dollarAccount = dollarAccount;
//       }
  
//       // Validate required payout details based on currency
//       if (eventDetails?.isNairaAccount && !nairaAccount) {
//         return ErrorHandler.badUserInput(res, "Naira Payout Details are required!");
//       }
  
//       if (eventDetails?.isDollarAccount && !dollarAccount) {
//         return ErrorHandler.badUserInput(res, "Dollar Payout Details are required!");
//       }
  
//       if (eventDetails?.isNairaAccount && eventDetails?.isDollarAccount) {
//         if (!nairaAccount && !dollarAccount) {
//           return ErrorHandler.badUserInput(res, "Naira and Dollar Payout Details are required!");
//         }
//       }

//       // Validate bank account details and create recipient code if nairaAccount is provided
//       if (eventDetails?.isNairaAccount && nairaAccount) {
//         // Validate account number only if nairaAccount is provided
//         const result = await PaymentService.validateBankAccount(
//             nairaAccount.accountNumber,
//             nairaAccount.bankCode
//         );
    
//         if (!result?.data || !result.data.account_name || !result.data.account_number) {
//             return ErrorHandler.badUserInput(res, "Invalid bank account details provided.");
//         }
    
//         // Generate recipient code
//         const recipientCode = await WithdrawalService.createRecipient(
//             result.data.account_name,
//             result.data.account_number,
//             nairaAccount.bankCode,
//             eventDetails.hostEmail
//         );
    
//         // Assign recipientCode to nairaAccount
//         nairaAccount.recipientCode = recipientCode;
//     }    
  
//       // Create Payment & Delivery record
//       const paymentSetup = await PaymentAndDeliveryService.createPaymentAndDelivery({
//         user: userId,
//         event: new mongoose.Types.ObjectId(req.body.event.trim()),
//         ...(paymentBody.nairaAccount && { nairaAccount: paymentBody.nairaAccount }),
//         ...(paymentBody.dollarAccount && { dollarAccount: paymentBody.dollarAccount }),
//         paymentDate: paymentBody.paymentDate,
//         paymentTime: paymentBody.paymentTime,
//         paymentTimeZone: paymentBody.paymentTimeZone,
//       });
  
//     return sendResponse(res, 201, "Payment setup successfully saved for later!", paymentSetup);

//   } catch (error: any) {
//     return ErrorHandler.internalServerError(res, error.message);
//   }
// }

static async paymentSetupSaveForLater(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return ErrorHandler.unauthorized(res, "Unauthorized");

    const { 
      nairaAccount: nairaData, 
      dollarAccount: dollarData, 
      event, 
      paymentDate, 
      paymentTime, 
      paymentTimeZone,
      isDraft,
    } = req.body;

    if (!event || typeof event !== "string") {
      return ErrorHandler.badUserInput(res, "Event ID must be a valid string");
    }

    // Validate request body
    // const { error } = validatePaymentAndDelivery(req.body);
    // if (error) return ErrorHandler.badUserInput(res, error.details[0].message);

    // Parallel fetch user, existing payment details, and event
    const [user, existingPaymentDetails, eventDetails] = await Promise.all([
      UserService.getUserById(userId),
      PaymentAndDeliveryService.getOneByField({ event: new mongoose.Types.ObjectId(event.trim()) }),
      EventService.getEventById(event.trim())
    ]);

    if (!user) return ErrorHandler.notFound(res, "User not found");
    if (existingPaymentDetails) return ErrorHandler.conflict(res, "Payment details already exists for this event!");
    if (!eventDetails) return ErrorHandler.notFound(res, "Event not found!");

    if (isDraft && typeof isDraft !== "boolean") {
      return ErrorHandler.badUserInput(res, "User can only input true or false for isDraft!");
    }

    // Prepare payment body
    const paymentBody: any = {
      event: event.trim(),
      paymentDate,
      paymentTime,
      paymentTimeZone,
    };

    // Validate and prepare nairaAccount
    let nairaAccount;
    if (eventDetails.isNairaAccount) {
      if (!nairaData?.accountNumber || !nairaData.bankName || !nairaData.accountName || !nairaData.bankCode) {
        return ErrorHandler.badUserInput(res, "Naira Payout Details are required!");
      }

      const { data: validatedAccount } = await PaymentService.validateBankAccount(
        nairaData.accountNumber.trim(),
        nairaData.bankCode.trim()
      );

      if (!validatedAccount?.account_name || !validatedAccount?.account_number) {
        return ErrorHandler.badUserInput(res, "Invalid bank account details provided.");
      }

      const recipientCode = await WithdrawalService.createRecipient(
        validatedAccount.account_name,
        validatedAccount.account_number,
        nairaData.bankCode.trim(),
        eventDetails.hostEmail
      );

      nairaAccount = {
        accountNumber: validatedAccount.account_number,
        bankName: nairaData.bankName.trim(),
        accountName: validatedAccount.account_name,
        bankCode: nairaData.bankCode.trim(),
        recipientCode,
      };

      paymentBody.nairaAccount = nairaAccount;
    }

    // Validate and prepare dollarAccount
    let dollarAccount;
    if (eventDetails.isDollarAccount) {
      if (!dollarData?.usAccountNumber || !dollarData.routingNumber || !dollarData.usBankName || !dollarData.usAccountName) {
        return ErrorHandler.badUserInput(res, "Dollar Payout Details are required!");
      }

      dollarAccount = {
        usAccountNumber: dollarData.usAccountNumber.trim(),
        routingNumber: dollarData.routingNumber.trim(),
        usBankName: dollarData.usBankName.trim(),
        usAccountName: dollarData.usAccountName.trim(),
      };

      paymentBody.dollarAccount = dollarAccount;
    }

    const paymentSetup = await PaymentAndDeliveryService.createPaymentAndDelivery({
      user: userId,
      event: new mongoose.Types.ObjectId(paymentBody.event),
      ...(paymentBody.nairaAccount && { nairaAccount: paymentBody.nairaAccount }),
      ...(paymentBody.dollarAccount && { dollarAccount: paymentBody.dollarAccount }),
      paymentDate,
      paymentTime,
      paymentTimeZone,
      isDraft,
    });

    return sendResponse(res, 201, "Payment setup successfully saved for later!", paymentSetup);
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
}



}

export default PaymentAndDeliveryController;
