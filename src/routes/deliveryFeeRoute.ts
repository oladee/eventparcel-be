import { Router } from "express";
import {
    getAllDeliveryFees,
    downloadTemplate,
    importDeliveryFeePreview,
    confirmDeliveryFeeImport,
    createDeliveryFee,
    updateDeliveryFee,
    deleteDeliveryFee,
} from "../controllers/deliveryFeeController";
import { authenticate, authorizeRole } from "../middleware/authentication";
import { upload } from "../middleware/newMulter";

const router = Router();

// Template download
router.get("/admin/delivery-fees/template", authenticate, authorizeRole("admin"), downloadTemplate);

// Import flow
router.post("/admin/delivery-fees/import", authenticate, authorizeRole("admin"), upload.single("file"), importDeliveryFeePreview);
router.post("/admin/delivery-fees/import/:importId/confirm", authenticate, authorizeRole("admin"), confirmDeliveryFeeImport);

// CRUD
router.get("/admin/delivery-fees", authenticate, authorizeRole("admin"), getAllDeliveryFees);
router.post("/admin/delivery-fees", authenticate, authorizeRole("admin"), createDeliveryFee);
router.patch("/admin/delivery-fees/:id", authenticate, authorizeRole("admin"), updateDeliveryFee);
router.delete("/admin/delivery-fees/:id", authenticate, authorizeRole("admin"), deleteDeliveryFee);

export default router;
