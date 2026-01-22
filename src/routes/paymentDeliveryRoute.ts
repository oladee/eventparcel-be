import { Router } from "express";
import PaymentAndDeliveryController from "../controllers/paymentDeliveryController";
import { authenticate } from "../middleware/authentication";


const router = Router();


// Create a new Payment and Delivery record
router.post('/add-payment', authenticate, PaymentAndDeliveryController.create);

// Get a single Payment and Delivery record by ID
router.get('/view-payment/:id', authenticate, PaymentAndDeliveryController.getOneById);

// Get a single Payment and Delivery record by Event ID 
router.get('/view-a-payment/:eventId', authenticate, PaymentAndDeliveryController.getOneByEventId);

// Get all Payment and Delivery records for a user
router.get('/get-all-by-user', authenticate, PaymentAndDeliveryController.getAllByUser);

// Update a Payment and Delivery record by event ID
router.put('/update/:eventId', authenticate, PaymentAndDeliveryController.updateById);

// Delete a Payment and Delivery record by ID
router.delete('/delete/:id', authenticate, PaymentAndDeliveryController.deleteById);

// Payment Setup Save For Later Route 
router.post('/payment-save-for-later', authenticate, PaymentAndDeliveryController.paymentSetupSaveForLater);



export default router;