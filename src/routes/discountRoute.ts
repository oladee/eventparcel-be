import { Router } from "express";
import { DiscountController } from "../controllers/discountController";
import { authenticate } from "../middleware/authentication";


const router = Router();


// Create a new Discount record
router.post('/add-discount', authenticate, DiscountController.create);

// Get a single Discount record by ID
router.get('/view-discount/:discountId', authenticate, DiscountController.getOne);

// Get all Discount records for a Host
router.get('/get-all-discounts/:hostId', authenticate, DiscountController.getAll);

// Update a Discount record by ID
router.put('/update-discount/:discountId', authenticate, DiscountController.update);

// Delete a Discount record by ID
router.delete('/delete-discount/:discountId', authenticate, DiscountController.delete);

// Generate alphanumeric discount code 
router.get("/discount-code", authenticate, DiscountController.generateDiscountCode);



export default router;