import { Router } from "express";
import { authenticate, authorizeRole } from "../middleware/authentication";
import {
    createState,
    getStates,
    deleteState,
    createCity,
    getCitiesByState,
    deleteCity,
    toggleDeliveryCovered,
    getDeliveryCoveredStates,
    checkStateDeliveryCoverage,
} from "../controllers/adminStateController";

const router = Router();

// ── States ──────────────────────────────────────────────────────────────
router.post("/admin/states", authenticate, authorizeRole("admin"), createState);
router.get("/states", getStates);
// router.patch("/admin/states/:stateId", authenticate, authorizeRole("admin"), updateState);
router.delete("/admin/states/:stateId", authenticate, authorizeRole("admin"), deleteState);

// ── Cities ───────────────────────────────────────────────────────────────
router.post("/admin/states/:stateId/cities", authenticate, authorizeRole("admin"), createCity);
router.get("/states/:stateId/cities", getCitiesByState);
// router.patch("/admin/states/:stateId/cities/:cityId", authenticate, authorizeRole("admin"), updateCity);
router.delete("/admin/states/:stateId/cities/:cityId", authenticate, authorizeRole("admin"), deleteCity);

// ── Delivery Coverage ────────────────────────────────────────────────────
router.patch("/admin/states/:stateId/delivery-covered", authenticate, authorizeRole("admin"), toggleDeliveryCovered);
router.get("/states/delivery-covered", getDeliveryCoveredStates);
router.get("/states/:stateId/delivery-covered", checkStateDeliveryCoverage);

export default router;
