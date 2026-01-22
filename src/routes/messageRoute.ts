import { Router } from "express";
import { sendInviteViaSMS, sendInviteViaWhatsApp, sendInviteViaBoth, getInviteDetails, getEventGroupContacts } from "../controllers/messageController";
import { authenticate } from "../middleware/authentication";

const router = Router();

// Send Invite via SMS to guests
router.post("/invite-sms", authenticate, sendInviteViaSMS);

// Send Invite via WhatsApp to guests
router.post("/invite-whatsapp", authenticate, sendInviteViaWhatsApp);

// Send Invite via Both (SMS and WhatsApp) to guests
router.post("/invite-both", authenticate, sendInviteViaBoth);

// View invite link for guest
router.get("/invite-details", getInviteDetails);

// Get contacts of an Event Group
router.get("/event-group-contacts/:eventGroupId", authenticate, getEventGroupContacts);


export default router;