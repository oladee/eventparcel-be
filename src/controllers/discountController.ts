import { Request, Response } from "express";
import DiscountService from "../services/discountServices";
import { validateDiscount, validateDiscountUpdate } from "../middleware/validator";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { IDiscount } from "../interfaces/modelInterface";
import { EventService } from "../services/eventServices";
import { generateAlphanumericCode } from "../helpers/helpers";
import { AuthenticatedRequest } from "../middleware/authentication";
import { OptionalAuthenticateRequest } from "src/middleware/optionalAuthenticate";
import { User } from "../models/userModel";

export class DiscountController {
  /**
 * Create a new discount
 */
static async create(req: Request, res: Response): Promise<Response | undefined> {
  try {
    const { error } = validateDiscount(req.body);
    if (error) {
      return ErrorHandler.badUserInput(res, error.details[0].message);
    }

    const { event, hostId, discountTitle, discountValue, discountValueType, discountCode } = req.body;

    if (discountTitle.length < 3 || discountTitle.length > 25) 
      return ErrorHandler.badUserInput(res, "Discount title must be between 3 and 25 characters.");

    const existingEvent = await EventService.getEventById(event);
    if (!existingEvent) {
      return ErrorHandler.notFound(res, "Event not found.");
    }

    // Check if the discountValueType is percentage and make sure it does not exceed 100%
    if (discountValueType === "percentage" && discountValue > 100) {
      return ErrorHandler.badUserInput(res, "Discount value cannot exceed 100% for percentage discounts.");
    }

    const discount = await DiscountService.createDiscount({
      event,
      hostId,
      discountTitle,
      discountValue,
      discountValueType,
      discountCode,
    } as IDiscount);

    if (!discount) {
      return ErrorHandler.badUserInput(res, "Failed to create discount.");
    }

    return sendResponse(res, 201, "Discount created successfully.", discount);

  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
}


  /**
   * Get a single discount by ID
   */
  static async getOne(req: Request, res: Response): Promise<Response | undefined> {
    try {
        const discountId = req.params.discountId;
      if (!discountId) return ErrorHandler.badUserInput(res, "Discount ID is required");

      const discount = await DiscountService.getOneById(discountId);
      if (!discount) return ErrorHandler.notFound(res, "Discount not found");

      return sendResponse(res, 200, "Discount fetched successfully", discount);

    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
      }
  }

  // /**
  //  * Get all discounts
  //  */
  // static async getAll(req: OptionalAuthenticateRequest, res: Response): Promise<Response | undefined> {
  //   try {
  //     const { userId, role } = req.user;
  //     const hostIdForCoHost = req.user.hostId;


  //     const hostId = req.params.hostId;
  //     if (!hostId) return ErrorHandler.badUserInput(res, "Host ID is required");

  //     const hostDiscounts = hostId ? await DiscountService.getAll({ hostId }) : [];

  //     // Check and compare cohostId from the Event details 
  //     // Example: Check if any discount's event.coHost includes userId
  //     const cohostId = hostDiscounts.some(discount => discount?.(event as any)?.coHost?.includes(userId));

  //     const coHostDiscounts = userId ? await DiscountService.getAll({ hostId: cohostId }) : [];

  //     // Combine both and remove duplicates
  //   const combinedDiscountsMap = new Map<string, any>();

  //   [...hostDiscounts, ...coHostDiscounts].forEach((discount: any) => {
  //     const discountId = discount._id.toString();

  //     const isShared =
  //       Array.isArray(event.coHost) &&
  //       event.coHost.some((coHost: any) => coHost._id?.toString() === userId.toString());
      
  //       combinedDiscountsMap.set(discountId, {
  //         ...discount._doc,
  //         isShared,
  //       });
  //   });



  //     // Send response
  //     return sendResponse(res, 200, "Discounts fetched successfully", combinedDiscountsMap);

  //   } catch (error: any) {
  //       return ErrorHandler.internalServerError(res, error.message);
  //     }
  // }


  /**
 * Get all discounts
 */
// static async getAll(req: OptionalAuthenticateRequest, res: Response): Promise<Response | undefined> {
//   try {
//     const { userId, role, hostEmail } = req.user;
//     const hostIdForCoHost = req.user.hostId;
//     const hostId = req.params.hostId;

//     if (!hostId) return ErrorHandler.badUserInput(res, "Host ID is required");

//     // Fetch discounts directly related to the host
//     const hostDiscounts = await DiscountService.getAll({ 'hostId.email': hostEmail });

//     // Filter discounts where the event has coHost and includes the user
//     // const coHostDiscounts = hostDiscounts.filter((discount: any) => {
//     //   const event = discount.event;
//     //   return event?.coHost?.some((co: any) => co?._id?.toString() === userId?.toString());
//     // });
//     const coHostDiscounts = hostDiscounts.filter(discount => {
//       const coHosts = (discount.event as any)?.coHost || [];
//       return coHosts.includes(userId?.toString());
//     });

//     // Combine discounts: all host discounts and any co-hosted
//     const combinedDiscountsMap = new Map<string, any>();

//     [...hostDiscounts, ...coHostDiscounts].forEach((discount: any) => {
//       const event = discount.event;
//       const discountId = discount._id.toString();

//       const isShared =
//         Array.isArray(event?.coHost) &&
//         event.coHost.some((coHost: any) => coHost?._id?.toString() === userId?.toString());

//       combinedDiscountsMap.set(discountId, {
//         ...discount._doc,
//         isShared,
//       });
//     });

//     // Check if the user is a co-host and filter accordingly
//     console.log("userId", userId);
//     console.log("hostId", hostId);
//     console.log("Host Discounts: ", JSON.stringify(hostDiscounts, null, 2));
//     // console.log("CoHost Discounts: ", coHostDiscounts);

//     // Convert map values to array
//     const combinedDiscounts = role === "host"
//       ? Array.from(combinedDiscountsMap.values()) 
//       : Array.from(combinedDiscountsMap.values()).filter(e => e.isShared);
//       // console.log("combinedDiscounts", Array.from(combinedDiscountsMap.values()));

//     return sendResponse(res, 200, "Discounts fetched successfully", combinedDiscounts);
//   } catch (error: any) {
//     return ErrorHandler.internalServerError(res, error.message);
//   }
// }


/**
 * Get all discounts
 */
static async getAll(req: OptionalAuthenticateRequest, res: Response): Promise<Response | undefined> {
  try {
    const { userId, role, hostEmail } = req.user;
    const hostId = req.params.hostId;

    if (!hostId) return ErrorHandler.badUserInput(res, "Host ID is required");

    // Step 1: Fetch all discounts for events owned by the host
    const hostDiscounts = await DiscountService.getAll({ hostId });

    // Step 2: Fetch the current user and their co-hosted events
    const currentUser = await User.findById(userId)
      .select("eventCoHosts")
      .populate("eventCoHosts.event");

    const coHostedEventIds = currentUser?.eventCoHosts?.map(e => e.event?._id?.toString()) || [];

    // Step 3: Fetch discounts on co-hosted events (separate from hostDiscounts)
    const coHostDiscounts = coHostedEventIds.length
      ? await DiscountService.getAll({ 'event': { $in: coHostedEventIds } })
      : [];

    // Step 4: Combine host & co-host discounts, deduplicated by discount ID
    const combinedDiscountsMap = new Map<string, any>();

    hostDiscounts.forEach((discount: any) => {
      const discountId = discount._id.toString();
      combinedDiscountsMap.set(discountId, {
        ...discount._doc,
        isShared: false, // belongs directly to host
      });
    });

    coHostDiscounts.forEach((discount: any) => {
      const discountId = discount._id.toString();
      combinedDiscountsMap.set(discountId, {
        ...discount._doc,
        isShared: true, // co-hosted event
      });
    });

    // Step 5: Final filtering based on role
    const combinedDiscounts = role === "host" //|| role === "superadmin"
      ? Array.from(combinedDiscountsMap.values())
      : Array.from(combinedDiscountsMap.values()).filter(e => e.isShared);

    return sendResponse(res, 200, "Discounts fetched successfully", combinedDiscounts);
  } catch (error: any) {
    return ErrorHandler.internalServerError(res, error.message);
  }
}



  /**
   * Update a discount by ID
   */
  static async update(req: Request, res: Response): Promise<Response | undefined> {
    try {
        const { error } = validateDiscountUpdate(req.body);
        if (error) {
          return ErrorHandler.badUserInput(res, error.details[0].message);
        }
        
        const discountId = req.params.discountId;
      if (!discountId) return ErrorHandler.badUserInput(res, "Discount ID is required");

        const discount = await DiscountService.getOneById(discountId);
        if (!discount) { 
            return ErrorHandler.notFound(res, "Discount not found!");
        }

        const updatedData = {
            discountTitle: req.body.discountTitle ?? discount.discountTitle,
            discountValue: req.body.discountValue ?? discount.discountValue,
            discountValueType: req.body.discountValueType ?? discount.discountValueType,
            discountStatus: req.body.discountStatus ?? discount.discountStatus,
            // discountCode: req.body.discountCode ?? discount.discountCode,
        }

        // if (req.body.discountTitle.length < 3 || req.body.discountTitle.length > 25) 
        //   return ErrorHandler.badUserInput(res, "Discount title must be between 3 and 25 characters.");

        // Check if the discountValueType is percentage and make sure it does not exceed 100%
        if (updatedData.discountValueType === "percentage" && updatedData.discountValue > 100) {
          return ErrorHandler.badUserInput(res, "Discount value cannot exceed 100% for percentage discounts.");
        }


      const updatedDiscount = await DiscountService.updateById(discountId, updatedData as IDiscount);
        if (!updatedDiscount) return ErrorHandler.badUserInput(res, "Discount not updated!");

        // send Response 
        return sendResponse(res, 200, "Discount updated successfully", updatedDiscount);

    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
      }
  }

  /**
   * Delete a discount by ID
   */
  static async delete(req: Request, res: Response): Promise<Response | undefined> {
    try {
        const discountId = req.params.discountId;
        if (!discountId) return ErrorHandler.badUserInput(res, "Discount ID is required");
  
          const discount = await DiscountService.getOneById(discountId);
          if (!discount) { 
              return ErrorHandler.notFound(res, "Discount not found!");
          }

      const deletedDiscount = await DiscountService.deleteById(discountId);
        if (!deletedDiscount) return ErrorHandler.badUserInput(res, "Discount not deleted!");

        // send Response 
        return sendResponse(res, 200, "Discount deleted successfully");

    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
      }
  }


  // Generate alphanumeric discount code
  static async generateDiscountCode(req: Request, res: Response): Promise<Response | undefined> {
    try {

    // Generate a unique discount code with max 10 attempts
    let discountCode: string | undefined;
    let unique = false;

    for (let i = 0; i < 10; i++) {
      const generatedCode = generateAlphanumericCode(8);
      const exists = await DiscountService.getOneByField({ discountCode: generatedCode });
      if (!exists) {
        discountCode = generatedCode;
        unique = true;
        break;
      }
    }

    if (!unique || !discountCode) {
      return ErrorHandler.internalServerError(res, "Failed to generate a unique discount code.");
    }

      // const discountCode = generateAlphanumericCode(8);
      return sendResponse(res, 200, "Discount code generated successfully", discountCode);

    } catch (error: any) {
      return ErrorHandler.internalServerError(res, error.message);
    }
  }
}
