import { Router } from "express";
import {
    importCSV,
    getAllDeliveryFees,
    createDeliveryFee,
    updateDeliveryFee,
    deleteDeliveryFee,
} from "../controllers/deliveryFeeController";
import { authenticate } from "../middleware/authentication";
import { upload } from '../middleware/newMulter';


const router = Router();

router.post("/import-delivery-fee", authenticate, upload.single("file"), importCSV);
router.get("/delivery-fee", authenticate, getAllDeliveryFees);
router.post("/add-delivery-fee", authenticate, createDeliveryFee);
router.patch("/update-delivery-fee/:id", authenticate, updateDeliveryFee);
router.delete("/delete-delivery-fee/:id", authenticate, deleteDeliveryFee);

export default router;
