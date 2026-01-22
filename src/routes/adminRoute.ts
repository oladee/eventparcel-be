import { Router } from "express";
import {
    signUp_Admin, loginAdmin, updateAdminUserStatus, disableAndEnableAdminUser,
    addAdmin, changeAdminPassword, getAllAdminUsers,
} from "../controllers/adminController";
import { authenticate, authorizeRole } from "../middleware/authentication";
import { getAdminDashboardData } from "../controllers/dashboardController";
// import { upload } from '../middleware/multer';

const router = Router();

// Admin Sign Up Route
router.post("/signup-admin", signUp_Admin);

// Admin Login Route
router.post("/login-admin", loginAdmin);

// Admin dashboard Route
router.get("/admin-dashboard", authenticate, authorizeRole('admin'), getAdminDashboardData);

// Add Admin route 
router.post("/add-admin", authenticate, authorizeRole('superAdmin'), addAdmin);

// Change Admin Password 
router.put("/change-admin-password", authenticate, authorizeRole('admin'), changeAdminPassword);

// Get all Admin Users
router.get("/get-all-admin-users", authenticate, authorizeRole('admin'), getAllAdminUsers);

// Update Admin User Status updateHostUserStatus
router.put("/update-admin-status", authenticate, authorizeRole('admin'), updateAdminUserStatus);

// Disable / Enable Admin User 
router.put("/disable-enable-admin", authenticate, authorizeRole('admin'), disableAndEnableAdminUser);



export default router;