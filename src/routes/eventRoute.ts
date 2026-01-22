import { Router } from "express";
import {
    createEvent, updateEvent, disableOrEnableEvent, deleteEvent, viewEvent, viewAllEvents,
    createEventGroup, updateEventGroup, disableOrEnableEventGroup, deleteEventGroup, viewEventGroup, viewAllEventGroups, viewAllEventGroupByAdmin,
    createPackage, updatePackage, deletePackage, viewPackage, viewAllPackages, viewAllPackageByAdmin,
    cloneEventGroup, saveForLater,
} from "../controllers/eventController";
import { authenticate } from "../middleware/authentication";
import { optionalAuthenticate } from "../middleware/optionalAuthenticate";
import { upload } from '../middleware/newMulter';

const router = Router();


//-----------------------------------------------------------------------------------------------------------------------------------------
//   ----- Routes for Events -----
// -----------------------------------------------------------------------------------------------------------------------------------------

// Create an Event
router.post("/add-event",  optionalAuthenticate, upload.single('eventImgUrl'), createEvent);

// View a particular Event
router.get("/view-event/:eventId", authenticate, viewEvent);

// View all Events
router.get("/view-events", authenticate, viewAllEvents);

// Update a particular Event
router.put("/update-event/:eventId", upload.single('eventImgUrl'), updateEvent);

// Disable or Enable a particular Event
router.put("/disable-enable/:eventId", disableOrEnableEvent);

// Delete a particular Event
router.delete("/delete-event/:eventId", deleteEvent);

// Save an Event for Later
router.put("/save-for-later/:eventId", saveForLater);


//-----------------------------------------------------------------------------------------------------------------------------------------
//   ----- Routes for Event Groups -----
// -----------------------------------------------------------------------------------------------------------------------------------------

// Create an Event Group
router.post("/add-group", optionalAuthenticate, createEventGroup);

// View a particular Event Group
router.get("/view-group/:eventGroupId", viewEventGroup);

// View all Event Groups for a particular Event
router.get("/view-groups/:eventId", viewAllEventGroups);

// View all Event Groups by an Admin
router.get("/view-all-groups", authenticate, viewAllEventGroupByAdmin);

// Update a particular Event Group
router.put("/update-group/:eventGroupId", optionalAuthenticate, updateEventGroup);

// Disable or Enable a particular Event Group
router.put("/disable-enable-group/:eventGroupId", optionalAuthenticate, disableOrEnableEventGroup);

// Delete a particular Event Group
router.delete("/delete-group/:eventGroupId", optionalAuthenticate, deleteEventGroup);

// Clone an Event Group 
router.get("/clone-group/:eventGroupId", cloneEventGroup);


//-----------------------------------------------------------------------------------------------------------------------------------------
//   ----- Routes for Event Packages -----
// -----------------------------------------------------------------------------------------------------------------------------------------

// Create an Event Package (supports up to 4 images)
router.post("/add-package", optionalAuthenticate, upload.array('packageImgUrls', 4), createPackage);

// View a particular Event Package
router.get("/view-package/:packageId", viewPackage);

// View all Event Packages for a particular Event Group
router.get("/view-packages/:eventGroupId", viewAllPackages);

// View all Event Packages by an Admin
router.get("/view-all-packages", authenticate, viewAllPackageByAdmin);

// Update a particular Event Package (supports up to 4 images)
router.put("/update-package/:packageId", optionalAuthenticate, upload.array('packageImgUrls', 4), updatePackage);

// Delete a particular Event Package
router.delete("/delete-package/:packageId", optionalAuthenticate, deletePackage);

export default router;
