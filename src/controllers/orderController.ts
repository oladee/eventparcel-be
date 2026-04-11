import { Request, Response } from "express";
import { EventService, EventGroupService, PackageService } from "../services/eventServices";
import { OrderService } from "../services/orderServices";
import { UserService } from "../services/userServices";
import { GIGService } from "../services/GIGservice";
import PaymentAndDeliveryService from "../services/paymentDeliveryServices";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import PaymentService from "../services/paymentServices";
import DiscountService from "../services/discountServices";
import { IGuestTracking, IHost, INotification, IOrder, IOrderItem, IPackage, IPayment } from "../interfaces/modelInterface";
import { validateGuestCheckout } from "../middleware/validator";
import { IWeekSummary, IDeliveredSummary, IPendingSummary, IOrderSummary, ISalesSummary, IPickUpDetails, IShippedSummary } from "../interfaces/interface";
import mongoose from "mongoose";
import { GuestTracking } from "../models/guestTrackingModel";
import { NotificationService } from "../services/notificationServices";
import { ref } from "@hapi/joi";
import { OptionalAuthenticateRequest } from "../middleware/optionalAuthenticate";
import ActivityLogService from "../services/activityLogService";
import { computeDeliveryFee, convertNgnToUsd, convertUsdToNgn, formatPrice, hasPlatformHomeDelivery, hasPlatformHomeDelivery2, stripCountryCode, titleCase, toTitleCase } from "../helpers/helpers";
import { sendMail } from "../utils/emailHandler/email";
import { notificationEmail } from "../utils/emailHandler/notificationEmailTemplate";

const taxRate: number = 0;


// export const checkoutGuest = async (req: Request, res: Response): Promise<Response | undefined> => {
//     try {
//         const { eventId, eventGroupId } = req.params;
//         const { guestName, guestEmail, guestPhoneNumber, items, discountCode, billingAddress, shippingAddress } = req.body;

//         if (!eventId || !eventGroupId) return ErrorHandler.notFound(res, "Event ID and Event Group ID are required!");
//         if (!guestName || !guestEmail || !guestPhoneNumber || !billingAddress || !shippingAddress) {
//             return ErrorHandler.badUserInput(res, "Guest information is incomplete!");
//         }
//         if (!items || !Array.isArray(items) || items.length === 0) {
//             return ErrorHandler.badUserInput(res, "At least one package must be selected!");
//         }

//         const eventGroup = await EventGroupService.getEventGroupById(eventGroupId);
//         if (!eventGroup) return ErrorHandler.notFound(res, "Event Group not found!");
//         if (eventGroup.isDisabled) return ErrorHandler.forbidden(res, "Sorry, this event group has been disabled!");

//         const event = await EventService.getEventById(eventId);
//         if (!event) return ErrorHandler.notFound(res, "Event not found!");
//         if (event.isDisabled) return ErrorHandler.forbidden(res, "Sorry, this event has been disabled!");

//         const hostDetails = await UserService.getUserByField({email: event.hostEmail});
//         if (!hostDetails) return ErrorHandler.notFound(res, "Host details not found!");

//         let totalAmount = 0;
//         let packageDetails: IOrderItem[] = [];

//         for (const pkg of items) {
//             const { packageId, quantity, deliveryMethod } = pkg;

//             if (!packageId || !quantity || quantity <= 0) {
//                 return ErrorHandler.badUserInput(res, "Each package must have a valid packageId and quantity.");
//             }

//             const eventPackage = await PackageService.getPackageById(packageId);
//             if (!eventPackage) return ErrorHandler.notFound(res, `Package with ID ${packageId} not found!`);

//             if (eventPackage.packageQuantity && quantity > eventPackage.packageQuantity) {
//                 return ErrorHandler.badUserInput(res, `Quantity for package ${packageId} exceeds available stock.`);
//             }

//             totalAmount += eventPackage.packagePrice * quantity;

//             packageDetails.push({
//                             packageId: new mongoose.Types.ObjectId(eventPackage._id),
//                             packageImgUrls: eventPackage.packageImgUrls,
//                             packageImgPublicIds: eventPackage.packageImgPublicIds,
//                             packageTitle: eventPackage.packageTitle,
//                             packageDescription: eventPackage.packageDescription,
//                             packagePriceCurrency: eventPackage.packagePriceCurrency,
//                             packagePrice: eventPackage.packagePrice,
//                             quantity: Number(quantity),
//                             deliveryMethod: deliveryMethod || null,
//                         } as IOrderItem);
//         }

//         // Create order using the corrected IOrder structure
//         const order = await OrderService.createOrder({
//             orderId: "", // This will be auto-generated in the pre-save hook
//             guestName,
//             guestEmail,
//             guestPhoneNumber,
//             hostId: new mongoose.Types.ObjectId(hostDetails._id),
//             eventId: new mongoose.Types.ObjectId(eventId),
//             eventGroupId: new mongoose.Types.ObjectId(eventGroupId),
//             items: packageDetails,
//             totalAmount,
//             billingAddress,
//             shippingAddress,
//             paymentStatus: "pending",
//             orderStatus: "pending",
//         } as Partial<IOrder> as IOrder);

//         // Initiate payment and get the payment URL
//         const paymentLink = await PaymentService.initiatePayment(guestEmail, totalAmount, order._id.toString());

//         return sendResponse(res, 201, "Order created successfully. Proceed to payment.", {
//             orderId: order.orderId,
//             guestName,
//             guestEmail,
//             guestPhoneNumber,
//             totalAmount,
//             paymentUrl: paymentLink,
//             eventId,
//             items: packageDetails,
//         });

//     } catch (error: unknown) {
//         if (error instanceof Error) {
//             return ErrorHandler.internalServerError(res, error.message);
//         }
//     }
// };

type StationIndex = {
    stateMap: Map<string, number>;
    nameMap: Map<string, number>;
};

function indexStations(stations: any[]): StationIndex {
    const stateMap = new Map<string, number>();
    const nameMap = new Map<string, number>();

    for (const station of stations) {
        stateMap.set(station.stateName.toLowerCase(), station.stationId);
        nameMap.set(station.stationName.toLowerCase(), station.stationId);
    }

    return { stateMap, nameMap };
}

function findStationIdFromAddress(address: string, index: StationIndex): number | null {
    const lower = address.toLowerCase();

    for (const [state, id] of index.stateMap.entries()) {
        if (lower.includes(state)) return id;
    }

    for (const [name, id] of index.nameMap.entries()) {
        if (lower.includes(name)) return id;
    }

    return null;
}


// const findStationIdFromAddress = (address: string, stations: any[]): number | null => {
//   const lower = address.toLowerCase();

//   // First try full state match
//   const stateMatch = stations.find(s =>
//     lower.includes(s.stateName.toLowerCase())
//   );
//   if (stateMatch) return stateMatch.stationId;

//   // Then try station name match
//   const nameMatch = stations.find(s =>
//     lower.includes(s.stationName.toLowerCase())
//   );
//   if (nameMatch) return nameMatch.stationId;

//   return null;
// };


const extractStateAndCityFromAddress = (address: string): { city?: string; state?: string } => {
    const parts = address.toLowerCase().split(',').map(part => part.trim());

    const knownStates = [
        "abia", "adamawa", "akwa ibom", "anambra", "bauchi", "bayelsa", "benue", "borno", "cross river",
        "delta", "ebonyi", "edo", "ekiti", "enugu", "gombe", "imo", "jigawa", "kaduna", "kano", "katsina",
        "kebbi", "kogi", "kwara", "lagos", "nasarawa", "niger", "ogun", "ondo", "osun", "oyo",
        "plateau", "rivers", "sokoto", "taraba", "yobe", "zamfara", "fct", "abuja"
    ];

    let state: string | undefined;
    let city: string | undefined;

    for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        if (!state && knownStates.includes(part)) {
            state = part;
            if (i > 0) city = parts[i - 1];
            break;
        }
    }

    return { state, city };
};




// // Function to get shipping price (GIG)
// const getShippingPrice = async (eventId: string, data: any) => {
//     try {
//         const senderDetails = await PaymentAndDeliveryService.getOneByField({ event: new mongoose.Types.ObjectId(eventId) });
//         if (!senderDetails) {
//             throw new Error("Sender details not found!");
//         }

//         const {
//             contactName: SenderName,
//             contactPhoneNumber: SenderPhoneNumber,
//             pickupLocation,
//             pickupLatitude,
//             pickupLongitude,
//         } = senderDetails;

//         const {
//             guestFirstName,
//             guestLastName,
//             guestPhoneNumber,
//             shippingAddress,
//             addressLatitude,
//             addressLongitude,
//             city,
//             state,
//             items,
//             dispatchType
//         } = data;

//         const { stationsData } = await GIGService.getLocalStations();
//         const stations = stationsData.object;
//         const stationIndex = indexStations(stations);
//         const { state: senderState, city: senderCity } = extractStateAndCityFromAddress(pickupLocation || "");
//         const senderSearchText = `${senderCity ?? ""} ${senderState ?? ""}`.trim();

//         const senderStationId = findStationIdFromAddress(senderSearchText, stationIndex);
//         const receiverStationId = findStationIdFromAddress(`${city} ${state}`, stationIndex);

//         if (!senderStationId || !receiverStationId) {
//             throw new Error("Unable to determine stationId from address.");
//         }

//         const shippingRequest = {
//             ReceiverAddress: shippingAddress || "Lagos, Nigeria",
//             CustomerCode: "ECO001449", // Replace or pull dynamically if needed
//             SenderLocality: "Ifako Ijaye", // You can customize this
//             SenderAddress: pickupLocation || "Lagos, Nigeria",
//             ReceiverPhoneNumber: stripCountryCode(guestPhoneNumber) || "+2348123456789",
//             VehicleType: dispatchType || "BIKE",
//             SenderPhoneNumber: stripCountryCode(SenderPhoneNumber) || "+2348123456789",
//             SenderName: SenderName?.trim() || "Event_Parcel",
//             ReceiverName: `${guestFirstName} ${guestLastName}`  || "Guest User",
//             // UserId: "f02ff192-11af-46b6-bd0a-bf118d0c3d47", // Replace if dynamic
//             ReceiverStationId: receiverStationId.toString(),
//             SenderStationId: senderStationId.toString(),
//             ReceiverLocation: {
//               Latitude: addressLatitude || "6.5483775",
//               Longitude: addressLongitude || "3.3883414"
//             },
//             SenderLocation: {
//               Latitude: pickupLatitude || "6.639438",
//               Longitude: pickupLongitude || "3.330983"
//             },
//             PreShipmentItems: items.map((item: any) => ({
//               SpecialPackageId: "0",
//               Quantity: item.quantity.toString(),
//               Weight: item.packageSize || "1",
//               ItemType: "Normal",
//               WeightRange: "0",
//               ItemName: item.packageTitle || "Item",
//               Value: item?.packagePrice?.toString() || "0",
//               ShipmentType: "Regular"
//             }))
//           };


//         // Call to shipping price service (replace with your actual API integration)
//         const shippingEstimate = await GIGService.getShippingPrice(shippingRequest);

//         return shippingEstimate;

//     } catch (error: any) {
//         console.error("Error fetching shipping price:", error);
//         throw new Error("Unable to fetch shipping price");
//     }
// };



// // Function to Capture Shipment (GIG)
// const captureShipmentGIG = async (eventId: string, data: any) => {
//     try {
//         const senderDetails = await PaymentAndDeliveryService.getOneByField({ event: new mongoose.Types.ObjectId(eventId) });
//         if (!senderDetails) {
//             throw new Error("Sender details not found!");
//         }

//         const {
//             contactName: SenderName,
//             contactPhoneNumber: SenderPhoneNumber,
//             pickupLocation,
//             pickupLatitude,
//             pickupLongitude,
//         } = senderDetails;

//         const {
//             guestFirstName,
//             guestLastName,
//             guestPhoneNumber,
//             shippingAddress,
//             addressLatitude,
//             addressLongitude,
//             city,
//             state,
//             items,
//             dispatchType
//         } = data;


//         const { stationsData } = await GIGService.getLocalStations(); // if live
//         const stations = stationsData.object;

//         const { state: senderState, city: senderCity } = extractStateAndCityFromAddress(pickupLocation || "");
//         const senderSearchText = `${senderCity ?? ""} ${senderState ?? ""}`.trim();
//         const senderStationId = findStationIdFromAddress(senderSearchText, stations);

//         const receiverStationId = findStationIdFromAddress(`${city} ${state}` || "", stations);

//         if (!senderStationId || !receiverStationId) {
//             throw new Error("Unable to determine stationId from address.");
//         }

//         const shippingRequest = {
//             ReceiverAddress: shippingAddress || "Lagos, Nigeria",
//             CustomerCode: "ECO001449", // Replace or pull dynamically if needed
//             SenderLocality: "Ifako Ijaye", // You can customize this
//             SenderAddress: pickupLocation || "Lagos, Nigeria",
//             ReceiverPhoneNumber: stripCountryCode(guestPhoneNumber),
//             VehicleType: dispatchType || "BIKE",
//             SenderPhoneNumber: stripCountryCode(SenderPhoneNumber) || "+2348123456789",
//             SenderName: SenderName || "Event_Parcel",
//             ReceiverName: `${guestFirstName} ${guestLastName}`  || "Guest User",
//             // UserId: "f02ff192-11af-46b6-bd0a-bf118d0c3d47", // Replace if dynamic
//             ReceiverStationId: receiverStationId.toString(),
//             SenderStationId: senderStationId.toString(),
//             ReceiverLocation: {
//               Latitude: addressLatitude || "6.5483775",
//               Longitude: addressLongitude || "3.3883414"
//             },
//             SenderLocation: {
//               Latitude: pickupLatitude || "6.639438",
//               Longitude: pickupLongitude || "3.330983"
//             },
//             PreShipmentItems: items.map((item: any) => ({
//               SpecialPackageId: "0",
//               Quantity: item.quantity.toString(),
//               Weight: item.packageSize || "1",
//               ItemType: "Normal",
//               WeightRange: "0",
//               ItemName: item.packageTitle || "Item",
//               Value: item?.packagePrice?.toString() || "0",
//               ShipmentType: "Regular"
//             }))
//           };


//         // Call to shipping price service (replace with your actual API integration)
//         const shippingEstimate = await GIGService.captureShipment(shippingRequest);

//         return shippingEstimate;

//     } catch (error: any) {
//         console.error("Error fetching shipping price:", error);
//         throw new Error("Unable to fetch shipping price");
//     }
// };


export async function buildShippingPayload(eventId: string, data: any, action: "get" | "capture") {
    const senderDetails = await PaymentAndDeliveryService.getOneByField({ event: new mongoose.Types.ObjectId(eventId) });
    if (!senderDetails) throw new Error("Sender details not found!");

    const {
        contactName: SenderName,
        contactPhoneNumber: SenderPhoneNumber,
        pickupLocation,
        pickupLatitude,
        pickupLongitude
    } = senderDetails;

    const {
        guestFirstName, guestLastName, guestPhoneNumber,
        shippingAddress, addressLatitude, addressLongitude,
        city, state, items, dispatchType
    } = data;

    const { stationsData } = await GIGService.getLocalStations();
    const stations = stationsData.object;
    const stationIndex = indexStations(stations);

    const { state: senderState, city: senderCity } = extractStateAndCityFromAddress(pickupLocation || "");
    const senderSearchText = `${senderCity ?? ""} ${senderState ?? ""}`.trim();
    const senderStationId = findStationIdFromAddress(senderSearchText, stationIndex);
    const receiverStationId = findStationIdFromAddress(`${city} ${state}` || "", stationIndex);

    if (!senderStationId || !receiverStationId) {
        throw new Error("Unable to determine stationId from address.");
    }

    return {
        ReceiverAddress: shippingAddress || "Lagos, Nigeria",
        CustomerCode: "ECO001449",
        SenderLocality: "Ifako Ijaye",
        SenderAddress: pickupLocation || "Lagos, Nigeria",
        ReceiverPhoneNumber: stripCountryCode(guestPhoneNumber),
        VehicleType: dispatchType || "BIKE",
        SenderPhoneNumber: stripCountryCode(SenderPhoneNumber),
        SenderName: SenderName || "Event_Parcel",
        ReceiverName: `${guestFirstName} ${guestLastName}` || "Guest User",
        ReceiverStationId: receiverStationId.toString(),
        SenderStationId: senderStationId.toString(),
        ReceiverLocation: {
            Latitude: addressLatitude || "",
            Longitude: addressLongitude || ""
        },
        SenderLocation: {
            Latitude: pickupLatitude || "",
            Longitude: pickupLongitude || ""
        },
        PreShipmentItems: items.map((item: any) => ({
            SpecialPackageId: "0",
            Quantity: item.quantity.toString(),
            Weight: item.packageSize || "1",
            ItemType: "Normal",
            WeightRange: "0",
            ItemName: item.packageTitle || "Item",
            Value: item?.packagePrice?.toString() || "0",
            ShipmentType: "Regular"
        }))
    };
}


// Function to handle package processes like update stock, send notifications, etc.
export const handlePackageProcess = async (order: IOrder, paymentRecord: any, host: IHost, eventGroup: any) => {

    // First we deduct the package stock
    const deductPromise = await PackageService.deductPackageQuantities(
        order.items.map((item) => ({
            ...item,
            quantity: item.quantity ?? null,
            packageId: item.packageId._id.toString(),
        }))
    );

    console.log("✅ Package quantity deducted successfully", deductPromise);

    const packageData = await deductPromise;

    const lowStockPackage = packageData?.find(
        (pkg) => (pkg?.packageQuantity ?? 0) < 6
    );
    if (lowStockPackage) {
        const notificationBody = `Your event group: ${eventGroup.groupName} of package: ${lowStockPackage.packageTitle} is running low on stock, remaining ${(lowStockPackage.packageQuantity ?? 0) < 0 ? 0 : (lowStockPackage.packageQuantity ?? 0)}.`;
        const hostName = `${titleCase(host.firstName)} ${titleCase(host.lastName)}`;

        await sendMail({
            email: host.email,
            subject: "Low Stock Quantity",
            html: notificationEmail((hostName ?? host.email), notificationBody),
        });
    }


    //     if (order.deliveryType === "pickUp") {
    //     // Send Pick Up Details Email    
    //     const pickUpEmail = `
    // <pre style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">

    // Dear ${toTitleCase(order.guestFirstName)} ${toTitleCase(order.guestLastName)},
    // We received your order and we can't wait to see you grace our occasion on the ${order?.eventId?.date} at ${order?.eventId?.time}.
    // Please find below pickup details for your parcel.

    // Contact Name: ${toTitleCase(order?.pickUpDetails?.contactName || "")}
    // Contact Phone Number: ${order?.pickUpDetails?.contactPhoneNumber}

    // PickUp Start Date: ${order?.pickUpDetails?.pickUpStartDate}
    // PickUp Start Time: ${order?.pickUpDetails?.pickUpStartTime} ${order?.pickUpDetails?.pickUpStartTimeZone}
    // PickUp Address: ${toTitleCase(order?.pickUpDetails?.pickUpAddress || "")}

    // Please note that you are responsible for contacting the person listed above and handling the pickup or delivery fees for your parcel. Also, your parcel will only be available for pickup starting from the stated pickup date, not before.

    // With Love,
    // ${toTitleCase(host.firstName)} ${toTitleCase(host.lastName)}
    // Event Parcel Limited.
    // </pre>
    //     `;

    //     await sendMail({
    //         email: order?.guestEmail,
    //         subject: "Pick Up Details",
    //         html: notificationEmail(((titleCase(`${host.firstName} ${host.lastName}`)) ?? host.email), pickUpEmail, true),
    //     });

    //     }

    // Email & Notification

    const now = new Date();
    const emailBody = `Payment of ${formatPrice(paymentRecord.amount, paymentRecord.currency as "NGN" | "USD" | undefined)} ${paymentRecord.currency} was successful. Reference: ${paymentRecord.paymentReference}.`;

    const [hostNotification] = await Promise.allSettled([
        NotificationService.createNotification({
            user: host._id,
            userType: "User",
            email: host.email,
            subject: "Payment Successful",
            message: `Your guest ${emailBody}`,
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString(),
        }),
    ]);

    [hostNotification].forEach((result, index) => {
        if (result.status === "rejected") {
            console.error(`❌ Error in Promise[${index}]:`, result.reason);
        } else {
            console.log(`✅ Promise[${index}] resolved successfully.`);
        }
    });
};



// // Function to handle guest checkout
// export const checkoutGuest = async (req: Request, res: Response): Promise<Response | undefined> => {
//     try {
//         const { error } = validateGuestCheckout(req.body);
//         if (error) {
//             return ErrorHandler.badUserInput(res, error.details[0].message);
//         }

//         const { eventId, eventGroupId } = req.params;
//         if (!eventId || !eventGroupId) return ErrorHandler.notFound(res, "Event ID and Event Group ID are required!");

//         const {
//             guestFirstName,
//             guestLastName,
//             guestEmail,
//             guestPhoneNumber,
//             items,
//             shippingAddress,
//             addressLatitude,
//             addressLongitude,
//             state,
//             city,
//             // dispatchType,
//             deliveryType,
//         } = req.body;

//         let { dispatchType } = req.body;

//         if (!guestFirstName || !guestLastName || !guestEmail || !guestPhoneNumber) {
//             return ErrorHandler.badUserInput(res, "Guest information is incomplete!");
//         }

//         // Check if home delivery is selected for dollar order
//         if (deliveryType === "homeDelivery") {
//             // Check if any item is in USD (dollar order)
//             const hasDollarItems = items.some((item: any) => 
//                 item.packagePriceCurrency === "USD" || item.currency === "USD"
//             );

//             // if (hasDollarItems) {
//             //     return ErrorHandler.badUserInput(
//             //         res, 
//             //         "Home delivery is not available for USD orders. Please choose pick-up option."
//             //     );
//             // }
//             if (hasDollarItems) {
//                 return ErrorHandler.badUserInput(
//                     res, 
//                     "We are currently unable to cover deliveries for dollar-based purchases."
//                 );
//             }

//             // Existing address validation
//             if (!shippingAddress || !state || !city) {
//                 return ErrorHandler.badUserInput(res, "Shipping address, state, city and dispatchType are required for Home Delivery!");
//             }
//         }

//         if (deliveryType === "homeDelivery") {
//             if (!shippingAddress || !state || !city) {
//                 return ErrorHandler.badUserInput(res, "Shipping address, state, city and dispatchType are required for Home Delivery!");
//             }
//         }

//         if (!items || !Array.isArray(items) || items.length === 0) {
//             return ErrorHandler.badUserInput(res, "At least one package must be selected!");
//         }

//         const eventGroup = await EventGroupService.getEventGroupById(eventGroupId);
//         if (!eventGroup) return ErrorHandler.notFound(res, "Event Group not found!");
//         if (eventGroup.isDisabled) return ErrorHandler.forbidden(res, "Sorry, this event group has been disabled!");

//         const event = await EventService.getEventById(eventId);
//         if (!event) return ErrorHandler.notFound(res, "Event not found!");
//         if (event.isDisabled) return ErrorHandler.forbidden(res, "Sorry, this event has been disabled!");

//         const hostDetails = await UserService.getUserByField({ email: event.hostEmail }) as IHost;
//         if (!hostDetails) return ErrorHandler.notFound(res, "Host details not found!");

//         let totalAmount = 0;
//         let packageDetails: IOrderItem[] = [];
//         let eventPackage;
//         let eventPackages: IPackage[] = [];

//         for (const pkg of items) {
//             const { packageId, quantity, deliveryMethod } = pkg;

//             if (!packageId || !quantity || quantity <= 0) {
//                 return ErrorHandler.badUserInput(res, "Each package must have a valid packageId and quantity.");
//             }

//             eventPackage = await PackageService.getPackageById(packageId);
//             if (!eventPackage) return ErrorHandler.notFound(res, `Package with ID ${packageId} not found!`);

//             if (typeof eventPackage.packageQuantity === 'number' && quantity > eventPackage.packageQuantity) {
//                 // return ErrorHandler.badUserInput(res, `Quantity for package: ${eventPackage.packageTitle} exceeds available stock.`);
//                 return ErrorHandler.badUserInput(res, "This package is currently out of stock, or the requested quantity is unavailable.");
//             }

//             totalAmount += eventPackage.packagePrice * quantity;

//             packageDetails.push({
//                 packageId: new mongoose.Types.ObjectId(eventPackage._id),
//                 packageImgUrls: eventPackage.packageImgUrls,
//                 packageImgPublicIds: eventPackage.packageImgPublicIds,
//                 packageTitle: eventPackage.packageTitle,
//                 packageDescription: eventPackage.packageDescription,
//                 packagePriceCurrency: eventPackage.packagePriceCurrency,
//                 packagePrice: eventPackage.packagePrice,
//                 quantity: Number(quantity),
//                 deliveryMethod: deliveryMethod || null,
//                 packageDeliveryType: eventPackage.packageDelivery,
//                 packageSize: eventPackage.packageSize || null,
//             } as IOrderItem);

//             // Check for multiple currencies in the items
//             const uniqueCurrencies = new Set(packageDetails.map(pkg => pkg.packagePriceCurrency));

//             if (uniqueCurrencies.size > 1) {
//                 return ErrorHandler.badUserInput(res, "Selected packages must use the same currency.");
//             }

//             // if (deliveryType === "homeDelivery" && deliveryMethod === "pickUp" ) {
//             //     return ErrorHandler.badUserInput(res, "Delivery Type and package delivery are not the same!")
//             // }
//             eventPackages.push(eventPackage)

//         }

//         const orderCurrency = packageDetails[0].packagePriceCurrency; // Assuming all packages have the same currency

//         let homeDeliveryFee = 0;
//         let pickUpDetails;

//         // "homeDelivery:selfManaged"

//         // Add shipping fee if homeDelivery
//         // if (deliveryType === "homeDelivery" && (packageDetails?.find((pkg: any) => pkg?.packageDeliveryType === "homeDelivery:platformDelivery") || eventPackages.find(pkg => pkg.packageDelivery.includes("homeDelivery:platformDelivery")))) {
//         if (hasPlatformHomeDelivery2(deliveryType, items, eventPackages)) {
//         //     const shippingRequest = await buildShippingPayload(eventId, {
//         //         guestFirstName,
//         //         guestLastName,
//         //         guestPhoneNumber,
//         //         shippingAddress,
//         //         addressLatitude,
//         //         addressLongitude,
//         //         city,
//         //         state,
//         //         dispatchType,
//         //         items: packageDetails,
//         //     }, "get");
//         //     const shippingPrice = await GIGService.getShippingPrice(shippingRequest);

//         //     console.log("Shipping Request: ", shippingRequest);
//         //     console.log("Shipping Price: ", shippingPrice);

//         // if (!shippingPrice) return ErrorHandler.notFound(res, "Shipping price not found!");
//         //     homeDeliveryFee = shippingPrice.shippingData.object.deliveryPrice || 0;

//         const selectedState = state.trim();
//         const statePricing = deliveryPricingTable.find(p => p.state.toLowerCase() === selectedState.toLowerCase());

//     if (statePricing) {
//         // State is within the five supported states
//         // If needed, show info modal about remote areas in the frontend
//         homeDeliveryFee = statePricing.baseFee;
//         // You can also add remoteAreaFee if applicable (logic in frontend)
//     } else {
//         // State is outside coverage
//         // Switch to self-delivery route
//         // Fee is not computed, log as self-delivery
//         homeDeliveryFee = 0;
//         dispatchType = "selfManaged";

//         // Optionally, you can trigger a host notification (handled via webhook/email)
//         // Example payload for webhook/email can be created here or later
//         console.log(
//             `Guest from ${selectedState} falls outside coverage. Marked as self-delivery.`
//         );
//     }
//         } 

//         if (deliveryType === "pickUp") {
//             const pickUpDetail = await PaymentAndDeliveryService.getOneByField({ event: new mongoose.Types.ObjectId(eventId) });
//             if (!pickUpDetail) {
//                return ErrorHandler.badUserInput(res, "Pick Up details not found!");
//             }

//             pickUpDetails = {
//                 contactName: pickUpDetail.contactName ?? "",
//                 contactPhoneNumber: pickUpDetail.contactPhoneNumber ?? "",
//                 pickUpStartDate: pickUpDetail.deliveryDate ?? "",
//                 pickUpStartTime: pickUpDetail.deliveryTime ?? "",
//                 pickUpStartTimeZone: pickUpDetail.deliveryTimeZone ?? "",
//                 pickUpAddress: pickUpDetail.pickupLocation ?? "",
//                 pickUpState: pickUpDetail.state ?? "",
//                 pickUpCity: pickUpDetail.city ?? "",
//             }
//         }

//         const newHomeDeliveryFeeByCurrency = orderCurrency === "USD" ? Number(await convertNgnToUsd(homeDeliveryFee)).toFixed(1) : homeDeliveryFee;

//         const estimateTransactionFee = (amount: number, currency: string): number => {
//             if (currency === "USD") {
//                 // PayPal charges 3.49% + $0.49 per transaction
//                 return amount * 0.0349 + 0.49;
//             } else if (currency === "NGN") {
//                 // Paystack charges 1.5% + ₦100 if amount > ₦2500
//                 const fee = amount * 0.015;
//                 return amount > 2500 ? fee + 100 : fee;
//             }
//             return 0; // Default case
//         };

//         const getMinimumPlatformMargin = (currency: string): number => {
//             if (currency === "USD") {
//                 return 1.00; // $1.00 minimum profit
//             } else if (currency === "NGN") {
//                 return 100; // ₦100 minimum profit
//             }
//             return 0;
//         };

//         const deliveryFee = Number(newHomeDeliveryFeeByCurrency) || 0;
//         const MIN_PLATFORM_MARGIN = getMinimumPlatformMargin(orderCurrency);
//         const estimatedTransactionFee = estimateTransactionFee(totalAmount, orderCurrency);

//         // Compute VAT after base item total
//         const VAT_tax = Number((totalAmount * taxRate).toFixed(2)) || 0;
//         totalAmount += (VAT_tax + Number(newHomeDeliveryFeeByCurrency));
//         console.log("VAT Tax: ", VAT_tax);
//         console.log("Home Delivery Fee: ", newHomeDeliveryFeeByCurrency);
//         console.log("Total Amount after VAT and Home Delivery Fee: ", totalAmount);


//         if (totalAmount < (Number(deliveryFee) + estimatedTransactionFee + MIN_PLATFORM_MARGIN)) {
//            return ErrorHandler.badUserInput(res, "Insufficient total amount to cover costs.");
//         }

//         // Create the order
//         const order = await OrderService.createOrder({
//             orderId: "",
//             guestFirstName,
//             guestLastName,
//             guestEmail,
//             guestPhoneNumber,
//             hostId: new mongoose.Types.ObjectId(hostDetails._id as string),
//             eventId: new mongoose.Types.ObjectId(eventId),
//             eventGroupId: new mongoose.Types.ObjectId(eventGroupId),
//             items: packageDetails,
//             totalAmount,
//             totalAmountCurrency: orderCurrency,
//             shippingAddress,
//             addressLatitude,
//             addressLongitude,
//             state,
//             city,
//             dispatchType,
//             homeDeliveryFee: newHomeDeliveryFeeByCurrency || undefined, // When home delivery fee is set, change zero to the actual fee from GIG or SelfManaged
//             deliveryType,
//             tax: VAT_tax,
//             paymentStatus: "pending",
//             orderStatus: "pending",
//             pickUpDetails,
//         } as Partial<IOrder> as IOrder);

//         // Ensure orderCurrency is valid before initiating payment
//         if (!orderCurrency || (orderCurrency !== "NGN" && orderCurrency !== "USD")) {
//             return ErrorHandler.badUserInput(
//                  res,
//                 "Unsupported or undefined currency. Only NGN and USD are allowed."
//             );
//         }

//         return sendResponse(res, 201, "Order created successfully. Continue to payment.", order);

//     } catch (error: unknown) {
//         if (error instanceof Error) {
//             return ErrorHandler.internalServerError(res, error.message);
//         }
//     }
// };


export const checkoutGuest = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const { error } = validateGuestCheckout(req.body);
        if (error) return ErrorHandler.badUserInput(res, error.details[0].message);

        const { eventId, eventGroupId } = req.params;
        if (!eventId || !eventGroupId)
            return ErrorHandler.notFound(res, "Event ID and Event Group ID are required!");

        const {
            guestFirstName,
            guestLastName,
            guestEmail,
            guestPhoneNumber,
            items,
            shippingAddress,
            addressLatitude,
            addressLongitude,
            state,
            city,
            deliveryType,
        } = req.body;

        let { dispatchType } = req.body;

        if (!guestFirstName || !guestLastName || !guestEmail || !guestPhoneNumber) {
            return ErrorHandler.badUserInput(res, "Guest information is incomplete!");
        }

        // ❌ Block USD-based orders for home delivery or platformDelivery
        if ((deliveryType === "homeDelivery" || deliveryType === "platformDelivery")) {
            const hasDollarItems = items.some(
                (item: any) =>
                    item.packagePriceCurrency === "USD" || item.currency === "USD"
            );

            if (hasDollarItems) {
                return ErrorHandler.badUserInput(
                    res,
                    "We are currently unable to cover deliveries for dollar-based purchases."
                );
            }

            if (!shippingAddress || !state || !city) {
                return ErrorHandler.badUserInput(
                    res,
                    "Shipping address, state, and city are required for Home Delivery!"
                );
            }
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return ErrorHandler.badUserInput(res, "At least one package must be selected!");
        }

        const eventGroup = await EventGroupService.getEventGroupById(eventGroupId);
        if (!eventGroup) return ErrorHandler.notFound(res, "Event Group not found!");
        if (eventGroup.isDisabled)
            return ErrorHandler.forbidden(res, "Sorry, this event group has been disabled!");

        const event = await EventService.getEventById(eventId);
        if (!event) return ErrorHandler.notFound(res, "Event not found!");
        if (event.isDisabled)
            return ErrorHandler.forbidden(res, "Sorry, this event has been disabled!");

        const hostDetails = (await UserService.getUserByField({
            email: event.hostEmail,
        })) as IHost;
        if (!hostDetails) return ErrorHandler.notFound(res, "Host details not found!");

        let totalAmount = 0;
        let itemTotal = 0;
        let packageDetails: IOrderItem[] = [];
        let eventPackages: IPackage[] = [];
        let orderCurrency: "NGN" | "USD" | null = null;

        for (const pkg of items) {
            const { packageId, quantity, deliveryMethod } = pkg;

            if (!packageId || !quantity || quantity <= 0) {
                return ErrorHandler.badUserInput(
                    res,
                    "Each package must have a valid packageId and quantity."
                );
            }

            const eventPackage = await PackageService.getPackageById(packageId);
            if (!eventPackage)
                return ErrorHandler.notFound(res, `Package with ID ${packageId} not found!`);

            if (
                typeof eventPackage.packageQuantity === "number" &&
                quantity > eventPackage.packageQuantity
            ) {
                return ErrorHandler.badUserInput(
                    res,
                    "This package is currently out of stock or the requested quantity is unavailable."
                );
            }

            const packageCurrency = (eventPackage.packagePriceCurrency || "").toUpperCase();
            if (!["NGN", "USD"].includes(packageCurrency)) {
                return ErrorHandler.badUserInput(
                    res,
                    "Unsupported package currency. Only NGN and USD are allowed."
                );
            }
            console.log(`Package ${eventPackage.packageTitle} currency: ${packageCurrency}`);
            if (!orderCurrency) {
                orderCurrency = packageCurrency as "NGN" | "USD";
            }

            let normalizedPackagePrice = eventPackage.packagePrice;
            let normalizedPackageCurrency = packageCurrency as "NGN" | "USD";

            if (orderCurrency === "USD" && packageCurrency === "NGN") {
                normalizedPackagePrice = await convertNgnToUsd(eventPackage.packagePrice);
                normalizedPackageCurrency = "USD";
            } else if (orderCurrency === "NGN" && packageCurrency === "USD") {
                normalizedPackagePrice = await convertUsdToNgn(eventPackage.packagePrice);
                normalizedPackageCurrency = "NGN";
            }

            totalAmount += normalizedPackagePrice * quantity;

            packageDetails.push({
                packageId: new mongoose.Types.ObjectId(eventPackage._id),
                packageImgUrls: eventPackage.packageImgUrls,
                packageImgPublicIds: eventPackage.packageImgPublicIds,
                packageTitle: eventPackage.packageTitle,
                packageDescription: eventPackage.packageDescription,
                packagePriceCurrency: normalizedPackageCurrency,
                packagePrice: normalizedPackagePrice,
                quantity: Number(quantity),
                deliveryMethod: deliveryMethod || null,
                packageDeliveryType: eventPackage.packageDelivery,
                packageSize: eventPackage.packageSize || null,
            } as IOrderItem);

            eventPackages.push(eventPackage);
        }

        itemTotal = totalAmount; // Store the original item total before adding fees and taxes

        if (!orderCurrency) {
            return ErrorHandler.badUserInput(res, "Unable to determine order currency.");
        }

        let homeDeliveryFee = 0;
        let pickUpDetails;

        // 🚚 Compute delivery fee if homeDelivery and platform handles it
        if (
            (deliveryType === "homeDelivery" || deliveryType === "platformDelivery") &&
            hasPlatformHomeDelivery2(deliveryType, items, eventPackages)
        ) {
            const pickupDetail = await PaymentAndDeliveryService.getOneByField({
                event: new mongoose.Types.ObjectId(eventId),
            });

            if (!pickupDetail)
                return ErrorHandler.badUserInput(res, "Pickup details not found for this event.");

            const pickupStateId = pickupDetail.state?.toString();
            const pickupCityId = pickupDetail.city?.toString();
            const guestStateId = state.trim();
            const guestCityId = city.trim();

            const totalPackages = items.reduce(
                (sum: number, pkg: any) => sum + pkg.quantity,
                0
            );

            // Compute delivery fee
            const computedDeliveryFee = await computeDeliveryFee(
                pickupStateId as string,
                pickupCityId as string,
                guestStateId,
                guestCityId,
                totalPackages
            );

            console.log("Computed Delivery fee by Event Parcel: ", computedDeliveryFee);

            if (computedDeliveryFee === 0) {
                dispatchType = "selfManaged";
                console.log(
                    `⚠️ No delivery fee mapping found for stateId:${pickupStateId} → stateId:${guestStateId}`
                );
            }

            homeDeliveryFee = computedDeliveryFee;
        }

        if (deliveryType === "pickUp") {
            const pickUpDetail = await PaymentAndDeliveryService.getOneByField({
                event: new mongoose.Types.ObjectId(eventId),
            });
            if (!pickUpDetail) {
                return ErrorHandler.badUserInput(res, "Pick Up details not found!");
            }

            pickUpDetails = {
                contactName: pickUpDetail.contactName ?? "",
                contactPhoneNumber: pickUpDetail.contactPhoneNumber ?? "",
                pickUpStartDate: pickUpDetail.deliveryDate ?? "",
                pickUpStartTime: pickUpDetail.deliveryTime ?? "",
                pickUpStartTimeZone: pickUpDetail.deliveryTimeZone ?? "",
                pickUpAddress: pickUpDetail.pickupLocation ?? "",
                pickUpState: pickUpDetail.state ?? "",
                pickUpCity: pickUpDetail.city ?? "",
            };
        }

        // 💵 Convert delivery fee to USD if needed
        const newHomeDeliveryFeeByCurrency =
            orderCurrency === "USD"
                ? Number(await convertNgnToUsd(homeDeliveryFee)).toFixed(1)
                : homeDeliveryFee;

        // 💰 Transaction fee estimation
        const estimateTransactionFee = (amount: number, currency: string): number => {
            if (currency === "USD") return amount * 0.0349 + 0.49;
            if (currency === "NGN") {
                const fee = amount * 0.015;
                return amount > 2500 ? fee + 100 : fee;
            }
            return 0;
        };

        const getMinimumPlatformMargin = (currency: string): number => {
            if (currency === "USD") return 1.0;
            if (currency === "NGN") return 100;
            return 0;
        };

        const deliveryFee = Number(newHomeDeliveryFeeByCurrency) || 0;
        console.log("Delivery Fee for Order: ", deliveryFee);
        const MIN_PLATFORM_MARGIN = getMinimumPlatformMargin(orderCurrency);
        const estimatedTransactionFee = estimateTransactionFee(totalAmount, orderCurrency);

        const VAT_tax = Number((totalAmount * taxRate).toFixed(2)) || 0;
        
        totalAmount += VAT_tax + Number(newHomeDeliveryFeeByCurrency) + estimatedTransactionFee;

        if (
            totalAmount <
            Number(deliveryFee) + estimatedTransactionFee + MIN_PLATFORM_MARGIN
        ) {
            return ErrorHandler.badUserInput(res, "Insufficient total amount to cover costs.");
        }

        // ✅ Create order
        const order = await OrderService.createOrder({
            orderId: "",
            guestFirstName,
            guestLastName,
            guestEmail,
            guestPhoneNumber,
            hostId: new mongoose.Types.ObjectId(hostDetails._id?.toString()),
            eventId: new mongoose.Types.ObjectId(eventId),
            eventGroupId: new mongoose.Types.ObjectId(eventGroupId),
            items: packageDetails,
            totalAmount,
            totalAmountCurrency: orderCurrency,
            shippingAddress,
            addressLatitude,
            addressLongitude,
            state,
            city,
            dispatchType,
            homeDeliveryFee: newHomeDeliveryFeeByCurrency || undefined,
            txnFee: estimatedTransactionFee,
            itemTotal, // Original package total before fees and taxes
            deliveryType,
            tax: VAT_tax,
            paymentStatus: "pending",
            orderStatus: "pending",
            pickUpDetails,
        } as Partial<IOrder> as IOrder);

        if (!["NGN", "USD"].includes(orderCurrency)) {
            return ErrorHandler.badUserInput(
                res,
                "Unsupported or undefined currency. Only NGN and USD are allowed."
            );
        }

        const orderResponse = {
            ...order.toObject(), // Convert mongoose document to plain object
            itemTotal, // Original package amount
            deliveryFee: homeDeliveryFee ?? 0,
            subtotal: totalAmount - (homeDeliveryFee ?? 0), // Total after discount but before delivery fee
            grandTotal: totalAmount
        };

        return sendResponse(
            res,
            201,
            "Order created successfully. Continue to payment.",
            orderResponse
        );
    } catch (error: unknown) {
        if (error instanceof Error) {
            return ErrorHandler.internalServerError(res, error.message);
        }
    }
};


export const contGuestCheckout = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {

        const { orderId } = req.params;
        if (!orderId) return ErrorHandler.badUserInput(res, "Order ID is required!");

        const { discountCode } = req.body;
        // if (!discountCode) return ErrorHandler.badUserInput(res, "Discount code is required!");

        const order = await OrderService.getOrderById(orderId);
        if (!order) return ErrorHandler.notFound(res, "Order not found!");

        // ✅ NEW: Prevent duplicate payment attempts
        if (order.paymentStatus === "paid") {
            return ErrorHandler.badUserInput(res, "This order has already been paid for.");
        }

        if (order.paymentStatus === "processing") {
            return ErrorHandler.badUserInput(res, "Payment is already being processed for this order. Please wait or check your email.");
        }

        // ✅ NEW: Lock the order to prevent concurrent payment attempts
        const lockResult = await OrderService.updateOrderById(
            orderId, 
            { paymentStatus: "processing" },
            true
        );
        
        if (!lockResult) {
            return ErrorHandler.badUserInput(res, "Unable to process payment at this time. Please try again.");
        }

        const { totalAmount, homeDeliveryFee, tax, totalAmountCurrency, eventGroupId, eventId, guestFirstName, guestLastName, guestEmail, guestPhoneNumber,txnFee, shippingAddress, addressLatitude, addressLongitude, city, state, dispatchType, items, itemTotal } = order;

        let newTotalAmount = totalAmount;
        // console.log("Initial Total Amount: ", newTotalAmount);

        // Handle Discount if discountCode is provided
        let discountAmount = 0;
        if (discountCode) {
            const discount = await DiscountService.getOneByField({
                discountCode: discountCode,
                event: new mongoose.Types.ObjectId(eventId),
                discountStatus: "active",
            });

            if (!discount) {
                return ErrorHandler.badUserInput(res, "Invalid or inactive discount code.");
            }

            // Check if the discount type is percentage or NGN or USD
            if (discount.discountValueType !== "percentage" && discount.discountValueType !== totalAmountCurrency) {
                return ErrorHandler.badUserInput(res, `Discount currency (${discount.discountValueType}) does not match order currency (${totalAmountCurrency}).`);
            }

            // // Check if discount value is more than total amount 
            // if (discount.discountValue > newTotalAmount) {
            //     return ErrorHandler.badUserInput(res, "Discount value cannot be more than the total amount.");
            // }

            const checkDiscountUsageForEmail = await OrderService.getOrderByField({
                guestEmail: guestEmail,
                discountCode: discountCode,
                eventId: new mongoose.Types.ObjectId(eventId),
            });
            if (checkDiscountUsageForEmail) {
                return ErrorHandler.badUserInput(res, "You have already used this discount code for this event.");
            }

            // Before applying the discount, deduct the tax and homeDeliveryFee so we apply the discount to the package not the total including the tax and home delivery fee
            const totalPackageAmount =itemTotal;

            if (discount.discountValueType === "percentage") {
                discountAmount = (discount.discountValue / 100) * totalPackageAmount;
            } else {
                discountAmount = discount.discountValue;
            }

            // console.log("Discount Amount: ", discountAmount);

            // console.log("Total Package Amount (before discount): ", totalPackageAmount);

            // Apply the discount
            const amountAfterDiscount = Math.max(totalPackageAmount - discountAmount, 0);
            // console.log("Amount After Discount: ", amountAfterDiscount);
            // console.log("Discounted Amount: ", totalPackageAmount);

            // Now we add the homeDeliveryFee back and then calculate tax for the remaining amount after discount
            const newTax = Number((amountAfterDiscount * taxRate).toFixed(2)) ?? 0;
            // console.log("New Tax after Discount: ", newTax);

            // Update the new total amount
            newTotalAmount = amountAfterDiscount + newTax + (homeDeliveryFee ?? 0) +(txnFee ?? 0);

            // Prevent negative total
            if (newTotalAmount < 0) newTotalAmount = 0;

            // Increment usage count
            discount.totalUsed += 1;

            // Update overallValue with this transaction's discount amount
            discount.overallValue += discountAmount;
            order.tax = newTax; // Update the order's tax to reflect the new tax after discount
            order.discount = discountAmount ?? 0; // Store the discount amount in the order for reference

            await order.save()

            await discount.save();
        }

        const grandTotalAmount = newTotalAmount;

        let trackingId: string = "";
        let shipmentStatus: string = "";

        // // capture shipment if home delivery is selected
        // if (order?.deliveryType === "homeDelivery" && order?.items?.find((pkg: any) => pkg?.packageId?.packageDelivery === "homeDelivery:platformDelivery")) {
        //     const shippingRequest = await buildShippingPayload(eventId, {
        //         guestFirstName,
        //         guestLastName,
        //         guestPhoneNumber,
        //         shippingAddress,
        //         addressLatitude,
        //         addressLongitude,
        //         city,
        //         state,
        //         dispatchType,
        //         items: items,
        //     }, "capture");
        //     const captureShipment = await GIGService.captureShipment(shippingRequest);

        //     // const captureShipment = await captureShipmentGIG(eventId, {
        //     //     guestFirstName,
        //     //     guestLastName,
        //     //     guestPhoneNumber,
        //     //     shippingAddress,
        //     //     addressLatitude,
        //     //     addressLongitude,
        //     //     city,
        //     //     state,
        //     //     dispatchType,
        //     //     items: items,
        //     // });
        //     if (!captureShipment) return ErrorHandler.notFound(res, "Unable to capture shipment!");

        //     // console.log("Capture Shipment: ", captureShipment);
        //     trackingId = captureShipment?.captureData?.waybill || "";
        //     shipmentStatus = captureShipment?.captureData?.message || "";

        // }


        const updatedData = {
            totalAmount: grandTotalAmount,
            discountCode: discountCode || undefined,
            trackingId: trackingId || "",
            // orderStatus: shipmentStatus === 'Shipment created successfully' ? "shipped" : "pending",
        }

        const updatedOrder = await OrderService.updateOrderById(orderId, updatedData, true);
        if (!updatedOrder) return ErrorHandler.badUserInput(res, "Unable to update the Order details");

        let paymentLink: { paymentLink: string; reference: string } | undefined;
        let newPayment;

        // Initiate payment
        if (updatedData.totalAmount !== 0) {
           try {
            paymentLink = totalAmountCurrency === "NGN" ?
                await PaymentService.initiatePayment(guestEmail, updatedData.totalAmount, order._id.toString(), order.hostId.toString()) :
                await PaymentService.initiatePaymentPaypal(guestEmail, updatedData.totalAmount, order._id.toString(), order.hostId.toString(),);
            } catch (paymentError) {
                // ✅ Revert payment status if payment initiation fails
                await OrderService.updateOrderById(orderId, { paymentStatus: "pending" }, true);
                throw paymentError;
            }
        } else {
            // If total amount is zero, we can skip payment and directly update the order status
            newPayment = await PaymentService.createPaymentNew(order._id.toString(), order.hostId.toString(), guestEmail, 0, "paid", totalAmountCurrency)
            await OrderService.updateOrderById(orderId, { paymentStatus: "paid" });

            // Always assign paymentLink as an object
            paymentLink = {
                paymentLink: "",
                reference: newPayment.paymentReference,
            };
            console.log("Payment skipped as total amount is zero.");
        }

        // updated the Guest record by their phone number
        const guestTracking = await GuestTracking.findOneAndUpdate(
            { phoneNumber: guestPhoneNumber, eventGroupId: eventGroupId },
            { status: "ordered" },
            { new: true }
        );

        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        // const itemsName = order.items.length > 1 ? order.items.length + " items" : order.items[0].packageTitle;
        const itemsName = order.items.length > 1 ? `${order.items.length} items` : order.items[0].packageTitle;


        // Fetch host details
        const hostDetails = await UserService.getUserById(order.hostId.toString()) as IHost;
        if (!hostDetails) return ErrorHandler.notFound(res, "Host details not found!");

        // Fetch Group details
        const eventGroup = await EventGroupService.getEventGroupByIdFew(eventGroupId);
        if (!eventGroup) return ErrorHandler.notFound(res, "Event Group not found!");

        // Create notification for the host
        const notify: INotification = await NotificationService.createNotification({
            user: order.hostId,
            userType: "User",
            email: hostDetails.email,
            subject: "New Order Notification",
            message: `${guestFirstName} ${guestLastName} placed a new order for ${itemsName} totaling ${totalAmountCurrency} ${totalAmount}.`,
            time: formattedTime,
            date: formattedDate,
        });
        const partnerMap = { "NGN": "Paystack", "USD": "Paypal" };
        const formattedPaymentPartner = partnerMap[totalAmountCurrency] || "Unknown";

                const orderResponse = {
                    ...updatedOrder.toObject(), // Convert mongoose document to plain object
                    itemTotal: totalAmount - (tax + (homeDeliveryFee ?? 0)), // Original package amount
                    deliveryFee: homeDeliveryFee ?? 0,
                    subtotal: grandTotalAmount - (homeDeliveryFee ?? 0), // Total after discount but before delivery fee
                    grandTotal: grandTotalAmount
                };


        if (updatedData.totalAmount !== 0) {
            return sendResponse(res, 201, "Order updated successfully. Proceed to payment.", {
                orderResponse,
                paymentUrl: paymentLink.paymentLink,
                reference: paymentLink.reference,
                paymentPartner: formattedPaymentPartner,

            });
        } else {

            // call the handlePackageProcess function to update stock, send notifications, etc.
            await handlePackageProcess(updatedOrder, newPayment, hostDetails, eventGroup);

            // If the order is for pick up, send the pick up details email
            // and return the response with the updated order and payment details
            if (updatedOrder && updatedOrder._id) {
                if (order.deliveryType === "pickUp") {

                    const pickUpEmail = `
<pre style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">

Dear ${toTitleCase(order.guestFirstName)} ${toTitleCase(order.guestLastName)},
We received your order and we can't wait to see you grace our occasion on the ${order?.eventId?.date} at ${order?.eventId?.time}.
Please find below pickup details for your parcel.

Contact Name: ${toTitleCase(order?.pickUpDetails?.contactName || "")}
Contact Phone Number: ${order?.pickUpDetails?.contactPhoneNumber}

PickUp Start Date: ${order?.pickUpDetails?.pickUpStartDate}
PickUp Start Time: ${order?.pickUpDetails?.pickUpStartTime} ${order?.pickUpDetails?.pickUpStartTimeZone}
PickUp Address: ${toTitleCase(order?.pickUpDetails?.pickUpAddress || "")}

Please note that you are responsible for contacting the person listed above and handling the pickup or delivery fees for your parcel. Also, your parcel will only be available for pickup starting from the stated pickup date, not before.

With Love,
${toTitleCase(order?.eventId?.hostFirstName)} ${toTitleCase(order?.eventId?.hostLastName)}
Event Parcel Limited.
</pre>
`;

                    await sendMail({
                        email: order?.guestEmail,
                        subject: "Pick Up Details",
                        html: notificationEmail(((titleCase(`${order?.eventId?.hostFirstName} ${order?.eventId?.hostLastName}`)) ?? order?.eventId?.hostEmail), pickUpEmail, true),
                    });

                }
                return sendResponse(res, 201, "Order updated successfully!", {
                    orderResponse,
                    paymentUrl: `${process.env.CLIENT_URL}/orderSuccessful?orderId=${updatedOrder._id.toString()}`,
                    reference: paymentLink.reference,
                    paymentPartner: formattedPaymentPartner,
                })
            }
        }

    } catch (error: unknown) {
        // ✅ Revert payment status on any error
        if (req.params.orderId) {
            await OrderService.updateOrderById(req.params.orderId, { paymentStatus: "pending" }, true);
        }
        
        if (error instanceof Error) {
            return ErrorHandler.internalServerError(res, error.message);
        }
    }
}


// Function to track guest orders
export const trackGuestOrders = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const { orderId } = req.params;
        if (!orderId) return ErrorHandler.notFound(res, "Order ID is required!");

        const order = await OrderService.getOrderByField({ orderId });
        if (!order) return ErrorHandler.notFound(res, "Order not found!");

        if (order.paymentStatus !== "paid") return ErrorHandler.forbidden(res, "Order not paid yet!");

        if (order.orderStatus !== "shipped") return ErrorHandler.forbidden(res, "Order not shipped yet!");

        const trackingDetails = await GIGService.trackShipment(order.trackingId as string);
        if (!trackingDetails) return ErrorHandler.notFound(res, "Tracking details not found!");

        return sendResponse(res, 200, "Tracking details fetched successfully!", trackingDetails);

    } catch (error: any) {
        console.error("Error tracking shipment:", error);
        return ErrorHandler.internalServerError(res, error.message);
    }
}




// Function to check if all selected packages have the same currency
export const checkSameCurrency = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return ErrorHandler.badUserInput(res, "Items array is required.");
        }

        const currencies = new Set<string>();

        for (const item of items) {
            const pkg = await PackageService.getPackageById(item.packageId);
            if (!pkg) return ErrorHandler.notFound(res, `Package with ID ${item.packageId} not found.`);
            currencies.add(pkg.packagePriceCurrency);
        }

        if (currencies.size > 1) {
            return ErrorHandler.badUserInput(res, "Selected packages must use the same currency.");
        }

        return sendResponse(res, 200, "All packages use the same currency.", {
            currency: [...currencies][0],
        });

    } catch (err: unknown) {
        if (err instanceof Error) {
            return ErrorHandler.internalServerError(res, err.message);
        }
    }
};



// Function to calculate the discounted total amount
export const calculateDiscountedTotal = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const { items, discountCode, eventId } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return ErrorHandler.badUserInput(res, "Items array is required.");
        }

        let totalAmount = 0;
        const currencies = new Set<string>();

        for (const item of items) {
            const pkg = await PackageService.getPackageById(item.packageId);
            if (!pkg) return ErrorHandler.notFound(res, `Package with ID ${item.packageId} not found.`);

            const quantity = item.quantity || 1;
            totalAmount += pkg.packagePrice * quantity;
            currencies.add(pkg.packagePriceCurrency);
        }

        if (currencies.size > 1) {
            return ErrorHandler.badUserInput(res, "Selected packages must use the same currency.");
        }

        let discountAmount = 0;
        let discount;

        if (discountCode) {
            discount = await DiscountService.getOneByField({
                discountCode,
                event: eventId,
                discountStatus: "active"
            });

            if (!discount) {
                return ErrorHandler.badUserInput(res, "Invalid or inactive discount code.");
            }

            discountAmount = discount.discountValueType === "percentage"
                ? (discount.discountValue / 100) * totalAmount
                : discount.discountValue;

            if (discountAmount > totalAmount) discountAmount = totalAmount;
        }

        const finalAmount = Math.max(0, totalAmount - discountAmount);

        // const orderResponse = {
        //     ...order.toObject(), // Convert mongoose document to plain object
        //     itemTotal: totalAmount - (VAT_tax + (homeDeliveryFee ?? 0)), // Original package amount
        //     deliveryFee: homeDeliveryFee ?? 0,
        //     subtotal: totalAmount - (homeDeliveryFee ?? 0), // Total after discount but before delivery fee
        //     grandTotal: totalAmount
        // };

        return sendResponse(res, 200, "Calculated discounted total.", {
            originalTotal: totalAmount,
            discountCodeApplied: !!discountCode,
            discountAmount,
            finalAmount,
            currency: [...currencies][0],
            discountObject: discount,
        });

    } catch (err: unknown) {
        if (err instanceof Error) {
            return ErrorHandler.internalServerError(res, err.message);
        }
    }
};



// Function to view an order for a specific user
export const viewOrderDetails = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const { orderId } = req.params;
        if (!orderId) {
            return ErrorHandler.notFound(res, "Order ID not provided!");
        }

        const order = await OrderService.getOrderById(orderId);
        if (!order) {
            return ErrorHandler.notFound(res, "Order not found!");
        }

        return sendResponse(res, 200, "Order details successfully fetched!", order);
    } catch (error: unknown) {
        if (error instanceof Error) {
            return ErrorHandler.internalServerError(res, error.message);
        }
    }
};


// Function to view all orders for a specific event
export const viewAllOrdersForEvent = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const { eventId } = req.params;
        const { page = 1, limit = 10 } = req.query; // Default to page 1, limit 10

        if (!eventId) {
            return ErrorHandler.notFound(res, "Event ID not provided!");
        }

        const pageNumber = Number(page);
        const limitNumber = Number(limit);
        const skip = (pageNumber - 1) * limitNumber;

        const orders = await OrderService.getAllOrders({ eventId }, skip, limitNumber);
        if (!orders.length) {
            return sendResponse(res, 200, "No orders found for this event!", []);
        }

        const totalOrders = await OrderService.countOrders({ eventId });
        const totalPages = Math.ceil(totalOrders / limitNumber);

        const orderSummary = {
            ordersSummary: {
                totalOrders: {
                    overall: 1256,
                    byWeek: [
                        { week: "Week 1", orders: 320 },
                        { week: "Week 2", orders: 280 },
                        { week: "Week 3", orders: 340 },
                        { week: "Week 4", orders: 316 },
                    ],
                    growthRate: 1.0,
                },
                totalDelivered: {
                    overall: 186,
                    byWeek: [
                        { week: "Week 1", delivered: 50 },
                        { week: "Week 2", delivered: 40 },
                        { week: "Week 3", delivered: 55 },
                        { week: "Week 4", delivered: 41 },
                    ],
                    growthRate: 3.9,
                },
                pendingOrders: {
                    overall: 58,
                    byWeek: [
                        { week: "Week 1", pending: 15 },
                        { week: "Week 2", pending: 10 },
                        { week: "Week 3", pending: 20 },
                        { week: "Week 4", pending: 13 },
                    ],
                    growthRate: -4.0,
                },
            },
            invitesSummary: {
                totalInvites: 324,
                totalViewed: 210,
                viewedRate: 64.8,
            },
            recentOrders: [
                {
                    id: "order_001",
                    date: "2025-04-24",
                    status: "pending",
                    product: "6 Yards of Aso Oke and Gele for Women",
                    price: 560000,
                    quantity: 1,
                    image: "https://example.com/image1.jpg",
                },
            ],
        }

        return sendResponse(res, 200, "Orders successfully fetched!", {
            summary: orderSummary,
            orders,
            currentPage: pageNumber,
            totalPages,
            totalOrders,
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            return ErrorHandler.internalServerError(res, error.message);
        }
    }
};



// // Function to calculate order summary
// export const calculateOrderSummary = (orders: IOrder[], contacts?: IGuestTracking[]): IOrderSummary => {
//     const weeks = ["Week 1", "Week 2", "Week 3", "Week 4"];

//     // Helper function to determine the week based on createdAt
//     const getWeek = (createdAt: string): string | null => {
//         const orderDate = new Date(createdAt);
//         const startDate = new Date();
//         startDate.setDate(startDate.getDate() - 28); // Assume a 4-week window

//         const diffDays = Math.floor((orderDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
//         const weekIndex = Math.floor(diffDays / 7);
//         return weeks[weekIndex] || null;
//     }

//     // Initialize week data
//     const weekData: Record<string, { orders: number; delivered: number; pending: number }> = weeks.reduce((acc, week) => {
//         acc[week] = { orders: 0, delivered: 0, pending: 0 };
//         return acc;
//     }, {} as Record<string, { orders: number; delivered: number; pending: number }>);


//     let totalOrders = 0;
//     let totalDelivered = 0;
//     let totalPending = 0;
//     let totalInvites = 0;

//     orders.forEach(order => {
//         const week = order.createdAt ? getWeek(order.createdAt.toISOString()) : null;
//         if (week) {
//             weekData[week].orders += 1;
//             totalOrders += 1;

//             if (order.orderStatus.toLowerCase() === "delivered" || order.orderStatus.toLowerCase() === "pickedUp") {
//                 weekData[week].delivered += 1;
//                 totalDelivered += 1;
//             } else {
//                 weekData[week].pending += 1;
//                 totalPending += 1;
//             }
//         }
//     });

//     // Convert weekData to array format
//     const byWeekOrders: IWeekSummary[] = weeks.map(week => ({ week, orders: weekData[week].orders }));
//     const byWeekDelivered: IDeliveredSummary[] = weeks.map(week => ({ week, delivered: weekData[week].delivered }));
//     const byWeekPending: IPendingSummary[] = weeks.map(week => ({ week, pending: weekData[week].pending }));

//     // Function to calculate growth rate
//     const calculateGrowthRate = (weekArray: { week: string; orders: number }[]): number => {
//         if (weekArray.length < 2) return 0;

//         const lastWeek = weekArray[weekArray.length - 1].orders;
//         const prevWeek = weekArray[weekArray.length - 2].orders;

//         if (prevWeek === 0) {
//             // Define your rule: from 0 to something = 100% or custom constant
//             return lastWeek > 0 ? 100 : 0;
//         }

//         return Math.round(((lastWeek - prevWeek) / prevWeek) * 100);
//     };    

//     return {
//         ordersSummary: {
//             totalOrders: {
//                 overall: totalOrders,
//                 byWeek: byWeekOrders,
//                 growthRate: calculateGrowthRate(byWeekOrders),
//             },
//             totalDelivered: {
//                 overall: totalDelivered,
//                 byWeek: byWeekDelivered,
//                 growthRate: calculateGrowthRate(byWeekDelivered.map(({ week, delivered }) => ({ week, orders: delivered }))),
//             },
//             pendingOrders: {
//                 overall: totalPending,
//                 byWeek: byWeekPending,
//                 growthRate: calculateGrowthRate(byWeekPending.map(({ week, pending }) => ({ week, orders: pending }))),
//             },
//         },
//         // invitesSummary: {
//         //     totalInvites: 324, // Placeholder
//         //     totalViewed: 210, // Placeholder
//         //     viewedRate: (210 / 324) * 100, // Placeholder
//         // },
//         invitesSummary: {
//             totalInvites: contacts?.length || 0,
//             totalViewed: contacts?.filter(c => c.hasViewed).length || 0,
//             viewedRate: contacts && contacts.length > 0
//                 ? Math.round((contacts.filter(c => c.hasViewed).length / contacts.length) * 100)
//                 : 0,
//         },

//         recentOrders: orders.slice(0, 5).map(order => ({
//             id: order.orderId,
//             date: (order.createdAt ? order.createdAt.toISOString().split("T")[0] : ""),
//             status: order.orderStatus,
//             product: order.items.map(item => item.packageTitle).join(", "),
//             price: order.totalAmount,
//             quantity: order.items.reduce((acc, item) => acc + item.quantity, 0),
//             image: order.items[0]?.packageImgUrls[0] || "", // Use first image if available
//         })),
//     };
// }



export const calculateOrderSummaryAdmin = (orders: IOrder[], contacts?: IGuestTracking[]): IOrderSummary => {
    const weeks = ["Week 1", "Week 2", "Week 3", "Week 4"];

    // --- Week Calculation Helper ---
    const getWeek = (createdAt: string): string | null => {
        const orderDate = new Date(createdAt);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 28); // 4-week window

        const diffDays = Math.floor((orderDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const weekIndex = Math.floor(diffDays / 7);

        return weeks[weekIndex] || null;
    };

    // --- Initialize Week Data ---
    const weekData: Record<string, { orders: number; delivered: number; pending: number, shipped: number }> = {};
    weeks.forEach(week => {
        weekData[week] = { orders: 0, delivered: 0, pending: 0, shipped: 0 };
    });

    // --- Totals ---
    let totalOrders = 0;
    let totalDelivered = 0;
    let totalPending = 0;
    let totalShipped = 0;


    // --- Populate Week Data ---
    orders.forEach(order => {
        totalOrders++; // ✅ Count all orders

        const status = order.orderStatus.toLowerCase();

        // ✅ Always count towards overall total
        if (status === "delivered" || status === "pickedup") {
            totalDelivered++;
        } else if (status === "pending") {
            totalPending++;
        } else {
            totalShipped++
        }

        // 🔍 Only group into a week if it's within the last 4 weeks
        const week = order.createdAt ? getWeek(order.createdAt.toISOString()) : null;
        if (!week) return;

        weekData[week].orders++;

        if (status === "delivered" || status === "pickedup") {
            weekData[week].delivered++;
        } else {
            weekData[week].pending++;
        }
    });

    // --- Format Weekly Arrays ---
    const byWeekOrders: IWeekSummary[] = weeks.map(week => ({
        week,
        orders: weekData[week].orders
    }));

    const byWeekDelivered: IDeliveredSummary[] = weeks.map(week => ({
        week,
        delivered: weekData[week].delivered
    }));

    const byWeekPending: IPendingSummary[] = weeks.map(week => ({
        week,
        pending: weekData[week].pending
    }));

    const byWeekShipped: IShippedSummary[] = weeks.map(week => ({
        week,
        shipped: weekData[week].shipped
    }))


    // --- Growth Rate Calculator with Stability ---
    const calculateGrowthRate = (weekArray: { week: string; orders: number }[]): number => {
        if (weekArray.length < 2) return 0;

        const last = weekArray[weekArray.length - 1].orders;
        const prev = weekArray[weekArray.length - 2].orders;

        if (prev === 0 && last === 0) return 0;
        if (prev === 0 && last > 0) return 100;

        const rate = ((last - prev) / prev) * 100;
        const cappedRate = Math.max(Math.min(rate, 100), -100); // Cap between -100% and +100%
        return Math.round(cappedRate);
    };

    // --- Invite Summary ---
    const totalInvites = contacts?.length || 0;
    const totalViewed = contacts?.filter(c => c.hasViewed).length || 0;
    const viewedRate = totalInvites > 0 ? Math.round((totalViewed / totalInvites) * 100) : 0;

    // --- Recent Orders ---
    const recentOrders = orders.slice(0, 5).map(order => ({
        id: order.orderId,
        date: order.createdAt ? order.createdAt.toISOString().split("T")[0] : "",
        status: order.orderStatus,
        product: order.items.map(item => item.packageTitle).join(", "),
        price: order.totalAmount,
        quantity: order.items.reduce((acc, item) => acc + item.quantity, 0),
        image: order.items[0]?.packageImgUrls[0] || ""
    }));

    // ---- Pacakge Sold ------
    // --- Total Packages Sold ---
    const totalPackageSold = orders
        .filter(order => order.paymentStatus?.toLowerCase() === "paid")
        .reduce((total, order) => {
            const orderTotal = order.items.reduce((sum, item) => sum + item.quantity, 0);
            return total + orderTotal;
        }, 0);

    // ----- Overall Sales for ----- 
    const overallSales = orders
        .filter(order => (order.paymentStatus || '').toLowerCase() === "paid")
        .reduce((sum, order) => sum + order.totalAmount, 0);


    // --- Final Result ---
    return {
        ordersSummary: {
            totalOrders: {
                overall: totalOrders,
                byWeek: byWeekOrders,
                growthRate: calculateGrowthRate(byWeekOrders),
            },
            totalDelivered: {
                overall: totalDelivered,
                byWeek: byWeekDelivered,
                growthRate: calculateGrowthRate(byWeekDelivered.map(({ week, delivered }) => ({ week, orders: delivered }))),
            },
            pendingOrders: {
                overall: totalPending,
                byWeek: byWeekPending,
                growthRate: calculateGrowthRate(byWeekPending.map(({ week, pending }) => ({ week, orders: pending }))),
            },
            shippedOrders: {
                overall: totalShipped,
                byWeek: byWeekShipped,
                growthRate: calculateGrowthRate(byWeekShipped.map(({ week, shipped }) => ({ week, orders: shipped }))),
            },
            packageSold: totalPackageSold,
            overallSales: overallSales,
        },
        invitesSummary: {
            totalInvites,
            totalViewed,
            viewedRate,
        },
        recentOrders
    };

}


// export const calculateOrderSummary = (orders: IOrder[], contacts?: IGuestTracking[]): IOrderSummary => {
//     const weeks = ["Week 1", "Week 2", "Week 3", "Week 4"];

//     // --- Week Calculation Helper ---
//     const getWeek = (createdAt: string): string | null => {
//         const orderDate = new Date(createdAt);
//         const startDate = new Date();
//         startDate.setDate(startDate.getDate() - 28); // 4-week window

//         const diffDays = Math.floor((orderDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
//         const weekIndex = Math.floor(diffDays / 7);

//         return weeks[weekIndex] || null;
//     };

//     // --- Initialize Week Data ---
//     const weekData: Record<string, { orders: number; delivered: number; pending: number, shipped: number }> = {};
//     weeks.forEach(week => {
//         weekData[week] = { orders: 0, delivered: 0, pending: 0, shipped: 0 };
//     });

//     // --- Totals ---
//     let totalOrders = 0;
//     let totalDelivered = 0;
//     let totalPending = 0;
//     let totalShipped = 0;


//     // --- Populate Week Data ---
//     orders.forEach(order => {
//         const week = order.createdAt ? getWeek(order.createdAt.toISOString()) : null;
//         if (!week) return;

//         const status = order.orderStatus.toLowerCase();
//         weekData[week].orders++;
//         totalOrders++;

//         if (status === "delivered" || status === "pickedup") {
//             weekData[week].delivered++;
//             totalDelivered++;
//         } else if (status === "pending") {
//             weekData[week].pending++;
//             totalPending++;
//         } else {
//             weekData[week].shipped++;
//             totalShipped++;
//         }
//     });

//     // --- Format Weekly Arrays ---
//     const byWeekOrders: IWeekSummary[] = weeks.map(week => ({
//         week,
//         orders: weekData[week].orders
//     }));

//     const byWeekDelivered: IDeliveredSummary[] = weeks.map(week => ({
//         week,
//         delivered: weekData[week].delivered
//     }));

//     const byWeekPending: IPendingSummary[] = weeks.map(week => ({
//         week,
//         pending: weekData[week].pending
//     }));

//     const byWeekShipped: IShippedSummary[] = weeks.map(week => ({
//         week,
//         shipped: weekData[week].shipped
//     }))

//     // --- Growth Rate Calculator with Stability ---
//     const calculateGrowthRate = (weekArray: { week: string; orders: number }[]): number => {
//         if (weekArray.length < 2) return 0;

//         const last = weekArray[weekArray.length - 1].orders;
//         const prev = weekArray[weekArray.length - 2].orders;

//         if (prev === 0 && last === 0) return 0;
//         if (prev === 0 && last > 0) return 100;

//         const rate = ((last - prev) / prev) * 100;
//         const cappedRate = Math.max(Math.min(rate, 100), -100); // Cap between -100% and +100%
//         return Math.round(cappedRate);
//     };

//     // --- Invite Summary ---
//     const totalInvites = contacts?.length || 0;
//     const totalViewed = contacts?.filter(c => c.hasViewed).length || 0;
//     const viewedRate = totalInvites > 0 ? Math.round((totalViewed / totalInvites) * 100) : 0;

//     // --- Recent Orders ---
//     const recentOrders = orders.slice(0, 5).map(order => ({
//         id: order.orderId,
//         date: order.createdAt ? order.createdAt.toISOString().split("T")[0] : "",
//         status: order.orderStatus,
//         product: order.items.map(item => item.packageTitle).join(", "),
//         price: order.totalAmount,
//         quantity: order.items.reduce((acc, item) => acc + item.quantity, 0),
//         image: order.items[0]?.packageImgUrls[0] || ""
//     }));

//     // ---- Pacakge Sold ------
//     // --- Total Packages Sold ---
//     const totalPackageSold = orders
//         .filter(order => order.paymentStatus?.toLowerCase() === "paid")
//         .reduce((total, order) => {
//             const orderTotal = order.items.reduce((sum, item) => sum + item.quantity, 0);
//             return total + orderTotal;
//         }, 0);

//     // ----- Overall Sales for ----- 
//     const overallSales = orders
//         .filter(order => (order.paymentStatus || '').toLowerCase() === "paid")
//         .reduce((sum, order) => sum + order.totalAmount, 0);


//     // --- Final Result ---
//     return {
//         ordersSummary: {
//             totalOrders: {
//                 overall: totalOrders,
//                 byWeek: byWeekOrders,
//                 growthRate: calculateGrowthRate(byWeekOrders),
//             },
//             totalDelivered: {
//                 overall: totalDelivered,
//                 byWeek: byWeekDelivered,
//                 growthRate: calculateGrowthRate(byWeekDelivered.map(({ week, delivered }) => ({ week, orders: delivered }))),
//             },
//             pendingOrders: {
//                 overall: totalPending,
//                 byWeek: byWeekPending,
//                 growthRate: calculateGrowthRate(byWeekPending.map(({ week, pending }) => ({ week, orders: pending }))),
//             },
//             shippedOrders: {
//                 overall: totalShipped,
//                 byWeek: byWeekShipped,
//                 growthRate: calculateGrowthRate(byWeekPending.map(({ week, pending }) => ({ week, orders: pending }))),
//             },
//             packageSold: totalPackageSold,
//             overallSales: overallSales,
//         },
//         invitesSummary: {
//             totalInvites,
//             totalViewed,
//             viewedRate,
//         },
//         recentOrders
//     };
// };



// // Function to fetch the Orders dynamically either by Event, Event Group or Host
// export const viewOrdersDynamically = async (req: Request, res: Response): Promise<Response | undefined> => {
//     try {
//         const { hostId, eventId, eventGroupId } = req.body;
//         const { page = 1, limit = 10, orderStatus } = req.query;

//         // Ensure only one filter is provided
//         const filters = [hostId, eventId, eventGroupId].filter(Boolean);
//         if (filters.length !== 1) {
//             return ErrorHandler.badUserInput(res, "Provide only one filter: hostId, eventId, or eventGroupId.");
//         }

//         // Construct query dynamically
//         const query: any = {};
//         if (hostId) query.hostId = hostId;
//         if (eventId) query.eventId = eventId;
//         if (eventGroupId) query.eventGroupId = eventGroupId;

//         const ordersQuery: Record<string, any> = { ...query };
//         if (orderStatus) ordersQuery.orderStatus = orderStatus; // Only add if provided
//         if (orderStatus && orderStatus === "delivered") ordersQuery.orderStatus = orderStatus === "delivered" || orderStatus === "pickedUp"

//         const filterType = hostId ? "host" : eventId ? "event" : "event group";

//         const pageNumber = Number(page);
//         const limitNumber = Number(limit);
//         const skip = (pageNumber - 1) * limitNumber;

//         // Fetch orders based on filters
//         const orders = await OrderService.getAllOrders(ordersQuery, skip, limitNumber);
//         if (!orders.length) {
//             return sendResponse(res, 200, `No orders found for the selected ${filterType}!`, []);
//         }

//         const orderSum = await OrderService.getAllOrders(query);

//         // Fetch contacts details on filters
//         const contacts = await GuestTracking.find({ query }).sort({ createdAt: -1 });

//         const totalOrders = await OrderService.countOrders(ordersQuery);
//         const totalPages = Math.ceil(totalOrders / limitNumber);

//         const orderSummary: IOrderSummary = calculateOrderSummary(orderSum, contacts);

//         return sendResponse(res, 200, `Orders successfully fetched for ${filterType}!`, {
//             orderSummary,
//             orders,
//             currentPage: pageNumber,
//             totalPages,
//             totalOrders,
//         });
//     } catch (error: unknown) {
//         if (error instanceof Error) {
//             return ErrorHandler.internalServerError(res, error.message);
//         }
//     }
// };


// Fetch orders dynamically by hostId, eventId, or eventGroupId



export const calculateOrderSummary = (orders: IOrder[], contacts?: IGuestTracking[]): IOrderSummary => {
    const weeks = ["Week 1", "Week 2", "Week 3", "Week 4"];

    // --- Week Calculation Helper ---
    const getWeek = (createdAt: string): string | null => {
        const orderDate = new Date(createdAt);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 28); // 4-week window

        const diffDays = Math.floor((orderDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const weekIndex = Math.floor(diffDays / 7);

        return weeks[weekIndex] || null;
    };

    // --- Initialize Week Data ---
    const weekData: Record<string, { orders: number; delivered: number; pending: number; shipped: number }> = {};
    weeks.forEach(week => {
        weekData[week] = { orders: 0, delivered: 0, pending: 0, shipped: 0 };
    });

    // --- OVERALL Totals (ALL orders, regardless of date) ---
    let totalOrders = 0;
    let totalDelivered = 0;
    let totalPending = 0;
    let totalShipped = 0;

    // Calculate OVERALL totals first (from ALL orders)
    orders.forEach(order => {
        const status = order.orderStatus.toLowerCase();
        totalOrders++;

        if (status === "delivered" || status === "pickedup") {
            totalDelivered++;
        } else if (status === "pending") {
            totalPending++;
        } else {
            totalShipped++;
        }
    });

    // --- Populate Week Data (only for last 28 days) ---
    orders.forEach(order => {
        const week = order.createdAt ? getWeek(order.createdAt.toISOString()) : null;
        if (!week) return; // Skip orders older than 28 days for weekly breakdown

        const status = order.orderStatus.toLowerCase();
        weekData[week].orders++;

        if (status === "delivered" || status === "pickedup") {
            weekData[week].delivered++;
        } else if (status === "pending") {
            weekData[week].pending++;
        } else {
            weekData[week].shipped++;
        }
    });

    // --- Format Weekly Arrays ---
    const byWeekOrders: IWeekSummary[] = weeks.map(week => ({
        week,
        orders: weekData[week].orders
    }));

    const byWeekDelivered: IDeliveredSummary[] = weeks.map(week => ({
        week,
        delivered: weekData[week].delivered
    }));

    const byWeekPending: IPendingSummary[] = weeks.map(week => ({
        week,
        pending: weekData[week].pending
    }));

    const byWeekShipped: IShippedSummary[] = weeks.map(week => ({
        week,
        shipped: weekData[week].shipped
    }));

    // --- Growth Rate Calculator with Stability ---
    const calculateGrowthRate = (weekArray: { week: string; orders: number }[]): number => {
        if (weekArray.length < 2) return 0;

        const last = weekArray[weekArray.length - 1].orders;
        const prev = weekArray[weekArray.length - 2].orders;

        if (prev === 0 && last === 0) return 0;
        if (prev === 0 && last > 0) return 100;

        const rate = ((last - prev) / prev) * 100;
        const cappedRate = Math.max(Math.min(rate, 100), -100); // Cap between -100% and +100%
        return Math.round(cappedRate);
    };

    // --- Invite Summary ---
    const totalInvites = contacts?.length || 0;
    const totalViewed = contacts?.filter(c => c.hasViewed).length || 0;
    const viewedRate = totalInvites > 0 ? Math.round((totalViewed / totalInvites) * 100) : 0;

    // --- Recent Orders ---
    const recentOrders = orders.slice(0, 5).map(order => ({
        id: order.orderId,
        date: order.createdAt ? order.createdAt.toISOString().split("T")[0] : "",
        status: order.orderStatus,
        deliveryMethod : order.deliveryType,
        product: order.items.map(item => item.packageTitle).join(", "),
        price: order.totalAmount,
        quantity: order.items.reduce((acc, item) => acc + item.quantity, 0),
        image: order.items[0]?.packageImgUrls[0] || ""
    }));

    // --- Total Packages Sold ---
    const totalPackageSold = orders
        .filter(order => order.paymentStatus?.toLowerCase() === "paid")
        .reduce((total, order) => {
            const orderTotal = order.items.reduce((sum, item) => sum + item.quantity, 0);
            return total + orderTotal;
        }, 0);

    // --- Overall Sales ---
    const overallSales = orders
        .filter(order => (order.paymentStatus || '').toLowerCase() === "paid")
        .reduce((sum, order) => sum + order.totalAmount, 0);

    // --- Final Result ---
    return {
        ordersSummary: {
            totalOrders: {
                overall: totalOrders,
                byWeek: byWeekOrders,
                growthRate: calculateGrowthRate(byWeekOrders),
            },
            totalDelivered: {
                overall: totalDelivered,
                byWeek: byWeekDelivered,
                growthRate: calculateGrowthRate(byWeekDelivered.map(({ week, delivered }) => ({ week, orders: delivered }))),
            },
            pendingOrders: {
                overall: totalPending,
                byWeek: byWeekPending,
                growthRate: calculateGrowthRate(byWeekPending.map(({ week, pending }) => ({ week, orders: pending }))),
            },
            shippedOrders: {
                overall: totalShipped,
                byWeek: byWeekShipped,
                growthRate: calculateGrowthRate(byWeekShipped.map(({ week, shipped }) => ({ week, orders: shipped }))), // Fixed: was using pending instead of shipped
            },
            packageSold: totalPackageSold,
            overallSales: overallSales,
        },
        invitesSummary: {
            totalInvites,
            totalViewed,
            viewedRate,
        },
        recentOrders
    };
};



export const viewOrdersDynamically = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const { hostId, eventId, eventGroupId } = req.body;
        const { page = 1, limit = 10, orderStatus, search } = req.query as {
            page?: string;
            limit?: string;
            orderStatus?: string;
            search?: string;
        };

        // Ensure exactly one filter is provided
        const filters = { hostId, eventId, eventGroupId };
        const activeFilters = Object.entries(filters).filter(([_, value]) => Boolean(value));
        if (activeFilters.length !== 1) {
            return ErrorHandler.badUserInput(res, "Provide only one filter: hostId, eventId, or eventGroupId.");
        }

        const [filterKey, filterValue] = activeFilters[0];
        const filterType = filterKey.replace(/Id$/, '').replace(/([A-Z])/g, ' $1').toLowerCase(); // e.g. eventGroupId -> "event group"

        const pageNumber = Math.max(1, parseInt(page as string, 10));
        const limitNumber = Math.max(1, parseInt(limit as string, 10));
        const skip = (pageNumber - 1) * limitNumber;

        // Construct base query
        const baseQuery: Record<string, any> = { [filterKey]: filterValue, paymentStatus: "paid" };

        // Construct full query
        const ordersQuery: Record<string, any> = { ...baseQuery };
        if (orderStatus) {
            ordersQuery.orderStatus = ["delivered", "pickedUp"].includes(orderStatus)
                ? { $in: ["delivered", "pickedUp"] }
                : orderStatus;
        }

        // Search filter ONLY by name or email
        const searchQuery: Record<string, any> = { ...baseQuery };

        if (typeof search === "string" && search.trim()) {
            const searchTerm = search.trim();
            const searchRegex = new RegExp(searchTerm, "i");

            const emailCondition = { guestEmail: searchRegex }; // fixed: should be guest email
            const orderIdCondition = { orderId: searchTerm }; // fixed: should be order ID

            if (searchTerm.includes(" ")) {
                const [first, last] = searchTerm.split(" ");
                searchQuery.$or = [
                    { guestFirstName: new RegExp(first, "i"), guestLastName: new RegExp(last, "i") },
                    { guestFirstName: new RegExp(last, "i"), guestLastName: new RegExp(first, "i") },
                    emailCondition,
                    orderIdCondition,
                ];
            } else {
                searchQuery.$or = [
                    { guestFirstName: searchRegex },
                    { guestLastName: searchRegex },
                    emailCondition,
                    orderIdCondition,
                ];
            }
        }

        // Parallel fetching for performance
        const [orders, totalOrders, orderSum, contacts] = await Promise.all([
            OrderService.getAllOrders((search ? searchQuery : ordersQuery), skip, limitNumber),
            OrderService.countOrders(search ? searchQuery : ordersQuery),
            OrderService.getAllOrders(baseQuery), // For summary (without pagination)
            GuestTracking.find(baseQuery).sort({ createdAt: -1 }),
        ]);

        const totalPages = Math.ceil(totalOrders / limitNumber);
        const  orderSummary: IOrderSummary = calculateOrderSummary(orderSum, contacts);

        if (!orders.length) {
            return sendResponse(res, 200, `No orders found for the selected ${filterType}.`, []);
        }

        let contactsCount = contacts?.length || 0;
        let stocks = 0;

        if (req.body.eventGroupId) {
            const eventGroup = await EventGroupService.getEventGroupById(req.body.eventGroupId);
            if (!eventGroup) return ErrorHandler.notFound(res, "Event Group not found!");
            contactsCount = eventGroup.contacts?.length || 0;
            // Fetch full package documents to access packageQuantity
            const packageDocs = await Promise.all(
                (eventGroup.packages || []).map(async (pkgId: any) => {
                    return await PackageService.getPackageById(pkgId);
                })
            );
            stocks = packageDocs.reduce((total, pkg) => total + (pkg?.packageQuantity || 0), 0);
        }

        // const newOrders = orders.map(order => {
        //     return {
        //         ...order.toObject(),
        //         deliveryType: order.deliveryType === "homeDelivery" ? "Home Delivery" : "Pick Up",
        //     };
        // });

        // Add contacts and stocks safely to orderSummary
        const fullOrderSummary: IOrderSummary = {
            ordersSummary: {
                ...orderSummary.ordersSummary,
                contacts: contactsCount,
                stocks,
            },
            invitesSummary: orderSummary.invitesSummary,
            recentOrders: orderSummary.recentOrders,
        };

        return sendResponse(res, 200, `Orders successfully fetched for ${filterType}.`, {
            orderSummary: fullOrderSummary,
            orders,
            currentPage: pageNumber,
            totalPages,
            totalOrders,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error occurred";
        return ErrorHandler.internalServerError(res, message);
    }
};



// export const updateOrderStatus = async (req: Request, res: Response): Promise<Response | undefined> => {
//     try {
//         const { orderId } = req.params;
//         const { paymentStatus, orderStatus } = req.body;

//         if (!orderId) {
//             return ErrorHandler.notFound(res, "Order ID is required!");
//         }

//         if (!paymentStatus && !orderStatus) {
//             return ErrorHandler.badUserInput(res, "At least one field (paymentStatus or orderStatus) is required for update!");
//         }

//         const validPaymentStatuses = ["pending", "paid"];
//         const validOrderStatuses = ["pending", "shipped", "delivered", "pickedUp"];

//         if (paymentStatus && !validPaymentStatuses.includes(paymentStatus.toLowerCase())) {
//             return ErrorHandler.badUserInput(res, "Invalid payment status!");
//         }

//         if (orderStatus && !validOrderStatuses.includes(orderStatus)) {
//             return ErrorHandler.badUserInput(res, "Invalid order status!");
//         }

//         // Fetch the order
//         const order = await OrderService.getOrderById(orderId);
//         if (!order) {
//             return ErrorHandler.notFound(res, "Order not found!");
//         }

//         // // Prepare update data
//         // const updateData = {
//         //     paymentStatus: paymentStatus || order.paymentStatus,
//         //     orderStatus: orderStatus || order.orderStatus,
//         // };

//         if (paymentStatus === "paid" && (orderStatus === "shipped" || orderStatus === "delivered" || orderStatus === "pickedUp")) {
//             return ErrorHandler.badUserInput(res, "Order cannot be shipped, delivered, or picked up without payment.")
//         } else if (order.paymentStatus === "paid" && (orderStatus === "shipped" || orderStatus === "delivered" || orderStatus === "pickedUp")) {
//             return ErrorHandler.badUserInput(res, "Order cannot be shipped, delivered, or picked up without payment.")
//         } else {
//             return ErrorHandler.badUserInput(res, "Invalid Payment or Orders status")
//         }

//             // Build update payload
//         const updateData: any = {};
//         if (paymentStatus) {
//             updateData.paymentStatus = paymentStatus.toLowerCase();
//         }
// if (orderStatus) {
//     const normalizedStatus = orderStatus.toLowerCase();
//     updateData.orderStatus = normalizedStatus;

//     // Define status ranks
//     const statusRank = {
//         pending: 0,
//         shipped: 1,
//         delivered: 2,
//         pickedup: 2,
//     };

//     const currentStatusRank = statusRank[order.orderStatus as keyof typeof statusRank] ?? 0;
//     const newStatusRank = statusRank[normalizedStatus as keyof typeof statusRank];

//     // Check for invalid or regressive status
//     if (newStatusRank === undefined) {
//         return ErrorHandler.badUserInput(res, "Invalid order status.");
//     }

//     if (newStatusRank < currentStatusRank) {
//         return ErrorHandler.badUserInput(
//             res,
//             `Order status cannot be updated from '${order.orderStatus}' to '${orderStatus}' — status regression is not allowed.`
//         );
//     }

//     // Assign the appropriate timestamp based on the order status
//     switch (normalizedStatus) {
//         case "shipped":
//             updateData.shippedAt = new Date();
//             break;
//         case "delivered":
//             updateData.deliveredAt = new Date();
//             break;
//         case "pickedup":
//             updateData.pickedUpAt = new Date();
//             break;
//     }

//     // Validate delivery type against the updated status
//     if (
//         order.deliveryType === "pickUp" &&
//         (normalizedStatus === "shipped" || normalizedStatus === "delivered")
//     ) {
//         return ErrorHandler.badUserInput(
//             res,
//             "Pickup orders cannot be updated to 'shipped' or 'delivered'."
//         );
//     }

//     if (
//         order.deliveryType === "homeDelivery" &&
//         normalizedStatus === "pickedup"
//     ) {
//         return ErrorHandler.badUserInput(
//             res,
//             "Home delivery orders cannot be updated to 'picked up'."
//         );
//     }
// }


//         // Update the order
//         const updatedOrder = await OrderService.updateOrderById(orderId, updateData, true);

//         return sendResponse(res, 200, "Order status updated successfully!", updatedOrder);
//     } catch (error: unknown) {
//         if (error instanceof Error) {
//             return ErrorHandler.internalServerError(res, error.message);
//         }
//     }
// };

// export const updateOrderStatus = async (req: OptionalAuthenticateRequest, res: Response): Promise<Response | undefined> => {
//     try {
//         const { orderId } = req.params;
//         const { paymentStatus, orderStatus } = req.body;

//         if (!orderId) {
//             return ErrorHandler.notFound(res, "Order ID is required!");
//         }

//         if (!paymentStatus && !orderStatus) {
//             return ErrorHandler.badUserInput(res, "At least one field (paymentStatus or orderStatus) is required for update!");
//         }

//         const validPaymentStatuses = ["pending", "paid"];
//         const validOrderStatuses = ["pending", "shipped", "delivered", "pickedUp"];

//         // Validate incoming statuses
//         if (paymentStatus && !validPaymentStatuses.includes(paymentStatus.toLowerCase())) {
//             return ErrorHandler.badUserInput(res, "Invalid payment status!");
//         }

//         if (orderStatus && !validOrderStatuses.includes(orderStatus)) {
//             return ErrorHandler.badUserInput(res, "Invalid order status!");
//         }

//         const order = await OrderService.getOrderById(orderId);
//         if (!order) {
//             return ErrorHandler.notFound(res, "Order not found!");
//         }

//         // Determine final paymentStatus and orderStatus to evaluate business logic
//         const newPaymentStatus = paymentStatus?.toLowerCase() || order.paymentStatus;
//         const newOrderStatus = orderStatus || order.orderStatus;

//         if (
//             newPaymentStatus !== "paid" &&
//             ["shipped", "delivered", "pickedUp"].includes(newOrderStatus)
//         ) {
//             return ErrorHandler.badUserInput(
//                 res,
//                 "Order cannot be shipped, delivered, or picked up without payment."
//             );
//         }

//         const updateData: any = {};
//         if (paymentStatus) {
//             updateData.paymentStatus = newPaymentStatus;
//         }

//         if (orderStatus) {
//             const normalizedStatus = orderStatus.toLowerCase();

//             // Map pickedUp to pickedup to handle timestamp mapping uniformly
//             const statusRank = {
//                 pending: 0,
//                 shipped: 1,
//                 delivered: 2,
//                 pickedUp: 2,
//             };

//             const currentStatusRank = statusRank[order.orderStatus.toLowerCase() as keyof typeof statusRank] ?? 0;
//             const newStatusRank = statusRank[normalizedStatus as keyof typeof statusRank];

//             if (newStatusRank === undefined) {
//                 return ErrorHandler.badUserInput(res, "Invalid order status.");
//             }

//             if (newStatusRank < currentStatusRank) {
//                 return ErrorHandler.badUserInput(
//                     res,
//                     `Order status cannot regress from '${order.orderStatus}' to '${orderStatus}'.`
//                 );
//             }

//             // Add timestamps
//             switch (normalizedStatus) {
//                 case "shipped":
//                     updateData.shippedAt = new Date();
//                     break;
//                 case "delivered":
//                     updateData.deliveredAt = new Date();
//                     break;
//                 case "pickedUp":
//                     updateData.pickedUpAt = new Date();
//                     break;
//             }

//             updateData.orderStatus = orderStatus;

//             // Delivery type validation
//             if (
//                 order.deliveryType === "pickUp" &&
//                 (normalizedStatus === "shipped" || normalizedStatus === "delivered")
//             ) {
//                 return ErrorHandler.badUserInput(
//                     res,
//                     "Pickup orders cannot be updated to 'shipped' or 'delivered'."
//                 );
//             }

//             if (
//                 order.deliveryType === "homeDelivery" &&
//                 normalizedStatus === "pickedUp"
//             ) {
//                 return ErrorHandler.badUserInput(
//                     res,
//                     "Home delivery orders cannot be updated to 'picked up'."
//                 );
//             }
//         }

//         const updatedOrder = await OrderService.updateOrderById(orderId, updateData, true);

//         const { userId, role } = req.user || {};
//         if (req.user && userId && role === "cohost") {
//           // ✅ Log activity for creating Event Group
//           await ActivityLogService.logActivity({
//             user: userId,
//             event: order?.eventId?._id.toString(),
//             group: order?.eventGroupId?._id.toString(),
//             action: "Updated an Order Status",
//             actionType: "Group",
//             entity: toTitleCase(order?.eventGroupId?.groupName),
//             entityType: toTitleCase(order?.eventGroupId?.groupPrivacy),
//             meta: {
//               description: order?.eventGroupId?.groupDescription || "NA",
//               currency: order?.eventGroupId?.groupCurrency,
//             },
//           });
//         }

//         return sendResponse(res, 200, "Order status updated successfully!", updatedOrder);
//     } catch (error: unknown) {
//         if (error instanceof Error) {
//             return ErrorHandler.internalServerError(res, error.message);
//         }
//     }
// };


export const updateOrderStatus = async (req: OptionalAuthenticateRequest, res: Response): Promise<Response | undefined> => {
    try {
        const { orderId } = req.params;
        const { paymentStatus, orderStatus } = req.body;

        if (!orderId) {
            return ErrorHandler.notFound(res, "Order ID is required!");
        }

        if (!paymentStatus && !orderStatus) {
            return ErrorHandler.badUserInput(res, "At least one field (paymentStatus or orderStatus) is required for update!");
        }

        const validPaymentStatuses = ["pending", "paid"];
        const validOrderStatuses = ["pending", "attempted", "shipped", "delivered", "pickedUp"];

        // Validate payment status (convert to lowercase)
        if (paymentStatus && !validPaymentStatuses.includes(paymentStatus.toLowerCase())) {
            return ErrorHandler.badUserInput(res, "Invalid payment status!");
        }

        // Validate order status (case-sensitive match to exact values)
        if (orderStatus && !validOrderStatuses.includes(orderStatus)) {
            return ErrorHandler.badUserInput(res, "Invalid order status!");
        }

        const order = await OrderService.getOrderById(orderId);
        if (!order) {
            return ErrorHandler.notFound(res, "Order not found!");
        }

        const newPaymentStatus = paymentStatus?.toLowerCase() || order.paymentStatus;
        const newOrderStatus = orderStatus || order.orderStatus;

        if (
            newPaymentStatus !== "paid" &&
            ["shipped", "delivered", "pickedUp"].includes(newOrderStatus)
        ) {
            return ErrorHandler.badUserInput(
                res,
                "Order cannot be shipped, delivered, or picked up without payment."
            );
        }

        const updateData: any = {};
        if (paymentStatus) {
            updateData.paymentStatus = newPaymentStatus;
        }

        if (orderStatus) {
            const statusRank: Record<string, number> = {
                pending: 0,
                attempted: 1,
                shipped: 1,
                delivered: 2,
                pickedUp: 2,
            };

            const currentStatusRank = statusRank[order.orderStatus] ?? 0;
            const newStatusRank = statusRank[orderStatus];

            if (newStatusRank === undefined) {
                return ErrorHandler.badUserInput(res, "Invalid order status.");
            }

            if (newStatusRank < currentStatusRank) {
                return ErrorHandler.badUserInput(
                    res,
                    `Order status cannot regress from '${order.orderStatus}' to '${orderStatus}'.`
                );
            }

            // Timestamp updates
            switch (orderStatus) {
                case "shipped":
                    updateData.orderStatus = newOrderStatus
                    updateData.shippedAt = new Date();
                    break;
                case "delivered":
                    updateData.orderStatus = newOrderStatus
                    updateData.deliveredAt = new Date();
                    break;
                case "pickedUp":
                    updateData.orderStatus = newOrderStatus
                    updateData.pickedUpAt = new Date();
                    break;
            }

            updateData.orderStatus = orderStatus;

            // Delivery type checks
            if (
                order.deliveryType === "pickUp" &&
                (orderStatus === "shipped" || orderStatus === "delivered")
            ) {
                return ErrorHandler.badUserInput(
                    res,
                    "Pickup orders cannot be updated to 'shipped' or 'delivered'."
                );
            }

            const deliveryTypes = ["homeDelivery", "platformDelivery", "selfManaged"] as const;

            if (deliveryTypes.includes(order.deliveryType as any) && orderStatus === "pickedUp") {

                const deliveryTypeLabels: Record<string, string> = {
                    homeDelivery: "Home delivery",
                    platformDelivery: "Platform delivery",
                    selfManaged: "Self-managed delivery"
                };

                const label = deliveryTypeLabels[order.deliveryType] || order.deliveryType;

                return ErrorHandler.badUserInput(
                    res,
                    `${label} orders cannot be updated to 'picked up'.`
                );
            }
        }

        const updatedOrder = await OrderService.updateOrderById(orderId, updateData, true);

        const { userId, role } = req.user || {};
        if (req.user && userId && role === "cohost") {
            await ActivityLogService.logActivity({
                user: userId,
                event: order?.eventId?._id.toString(),
                group: order?.eventGroupId?._id.toString(),
                action: "Updated an Order Status",
                actionType: "Group",
                entity: toTitleCase(order?.eventGroupId?.groupName),
                entityType: toTitleCase(order?.eventGroupId?.groupPrivacy),
                meta: {
                    description: order?.eventGroupId?.groupDescription || "NA",
                    currency: order?.eventGroupId?.groupCurrency,
                },
            });
        }

        return sendResponse(res, 200, "Order status updated successfully!", updatedOrder);
    } catch (error: unknown) {
        if (error instanceof Error) {
            return ErrorHandler.internalServerError(res, error.message);
        }
    }
};




// Function to get the sidebar order summary
export const getSidebarOrderSummary = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const { hostId, eventId, eventGroupId } = req.query;

        // Validate that only one filter is provided
        const filters = [hostId, eventId, eventGroupId].filter(Boolean);
        if (filters.length > 1) {
            return ErrorHandler.validationError(res, "You can only provide one of hostId, eventId, or eventGroupId.");
        }

        const baseQuery: Record<string, any> = {};
        if (hostId) baseQuery.hostId = hostId;
        if (eventId) baseQuery.eventId = eventId;
        if (eventGroupId) baseQuery.eventGroupId = eventGroupId;

        // Today range
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        const todayQuery = {
            ...baseQuery,
            createdAt: { $gte: yesterday, $lte: today },
        };

        const [totalOrders, pending, shipped, delivered, pickedUp, todayOrders] = await Promise.all([
            OrderService.countOrders(baseQuery),
            OrderService.countOrders({ ...baseQuery, orderStatus: "pending" }),
            OrderService.countOrders({ ...baseQuery, orderStatus: "shipped" }),
            OrderService.countOrders({ ...baseQuery, orderStatus: "delivered" }),
            OrderService.countOrders({ ...baseQuery, orderStatus: "pickedUp" }),
            OrderService.countOrders(todayQuery),
        ]);

        const filterType = hostId ? "host" : eventId ? "event" : eventGroupId ? "event group" : "all orders";

        return sendResponse(res, 200, `Sidebar order summary fetched successfully for ${filterType}!`, {
            totalOrders,
            pending,
            shipped,
            delivered,
            pickedUp,
            todayOrders,
        });
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

