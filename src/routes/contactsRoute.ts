import { Router } from "express";
import { extractCSV, saveExtractedContacts, } from "../controllers/contactController";
import { authenticate } from "../middleware/authentication";
import { csvUpload } from "../middleware/csvMulter";

const router = Router();


// Extract CSV file for the contacts
router.post("/extract-csv", authenticate, csvUpload.single("csvData"), extractCSV);

// Save extracted contact / selected contact
router.post("/save-contacts", authenticate, saveExtractedContacts);




export default router;