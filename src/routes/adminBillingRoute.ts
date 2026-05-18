import { Router } from "express";
import { authenticate, authorizeRole } from "../middleware/authentication";
import {
  listServiceFeeRates,
  upsertServiceFeeRate,
  deleteServiceFeeRate,
  listSouvenirListingsAdmin,
  createSouvenirListingAdmin,
  updateSouvenirListingAdmin,
  listCustomBagListingsAdmin,
  createCustomBagListingAdmin,
  updateCustomBagListingAdmin,
  listActiveSouvenirsHost,
  listActiveCustomBagsHost,
} from "../controllers/adminBillingController";

const router = Router();

router.get(
  "/admin/service-fee-rates",
  authenticate,
  authorizeRole("admin"),
  listServiceFeeRates
);
router.put(
  "/admin/service-fee-rates/:currency",
  authenticate,
  authorizeRole("admin"),
  upsertServiceFeeRate
);
router.delete(
  "/admin/service-fee-rates/:currency",
  authenticate,
  authorizeRole("admin"),
  deleteServiceFeeRate
);

router.get(
  "/admin/souvenir-listings",
  authenticate,
  authorizeRole("admin"),
  listSouvenirListingsAdmin
);
router.post(
  "/admin/souvenir-listings",
  authenticate,
  authorizeRole("admin"),
  createSouvenirListingAdmin
);
router.put(
  "/admin/souvenir-listings/:id",
  authenticate,
  authorizeRole("admin"),
  updateSouvenirListingAdmin
);

router.get(
  "/admin/custom-bag-listings",
  authenticate,
  authorizeRole("admin"),
  listCustomBagListingsAdmin
);
router.post(
  "/admin/custom-bag-listings",
  authenticate,
  authorizeRole("admin"),
  createCustomBagListingAdmin
);
router.put(
  "/admin/custom-bag-listings/:id",
  authenticate,
  authorizeRole("admin"),
  updateCustomBagListingAdmin
);

router.get(
  "/fulfillment-catalog/souvenirs",
  authenticate,
  authorizeRole("cohost"),
  listActiveSouvenirsHost
);
router.get(
  "/fulfillment-catalog/custom-bags",
  authenticate,
  authorizeRole("cohost"),
  listActiveCustomBagsHost
);

export default router;
