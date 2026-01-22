import { Router } from "express";
import {
    checkoutGuest, contGuestCheckout, checkSameCurrency, trackGuestOrders,
    calculateDiscountedTotal, viewOrderDetails, viewAllOrdersForEvent, 
    updateOrderStatus, viewOrdersDynamically, getSidebarOrderSummary,
} from "../controllers/orderController";
import { authenticate } from "../middleware/authentication";
import { optionalAuthenticate } from "../middleware/optionalAuthenticate";
import { upload } from '../middleware/newMulter';
import { getDeliverySummary } from "../controllers/deliveryController";

const router = Router();

// For guest to checkOut (Order for Package)
router.post("/guest-checkout/:eventId/:eventGroupId", checkoutGuest);

// Cont'd guest checkOut (Order for package)
router.post("/checkout-contd/:orderId", contGuestCheckout)

// Check if the currency is the same for the order
router.post("/check-same-currency", checkSameCurrency);

// Calculate the discounted total amount
router.post("/calculate-discounted-total", calculateDiscountedTotal);

// View Order Details
router.get("/view-order/:orderId", viewOrderDetails);

// View all Orders for an Event
router.get("/view-orders/:eventId", viewAllOrdersForEvent);

// View all Orders dynamically for an Event, EventGroup, or Host
router.post("/view-orders", viewOrdersDynamically);

// Update Order Status and Payment Status
router.put("/update-order/:orderId", optionalAuthenticate, updateOrderStatus);

// Get delivery summary for a specific host
router.get('/delivery-summary/:hostId', getDeliverySummary);

// Get sidebar order summary for a specific host
router.get('/sidebar-order-summary', getSidebarOrderSummary);

// Track guest orders
router.get("/track-guest-orders/:orderId", trackGuestOrders);


export default router;
