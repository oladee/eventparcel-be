import { Router } from "express";
import {
  signUp_User,
  AddCoHostNew,
  acceptInvite,
  declineInvite,
  cancelInvite,
  getAllCoHosts,
  disableCoHost,
  updateCoHost,
  removeCoHost,
  getAllCoHostsForHost,
  loginUser,
  verifyOTP,
  getUserProfile,
  resendOTP,
  resendOTPForgetPassword,
  forgotPassword,
  resetPassword,
  changePassword,
  updateUserProfile,
  deleteUserProfile,
  signOut,
  getAllUserProfiles,
  verify_Email,
  refreshTokenGenerate,
  userProfile,
  getUserDetails,
  updateUserDetails,
  uploadAPhoto,
  updateHostUserStatus,
} from "../controllers/userController";
import { authenticate, authorizeRole } from "../middleware/authentication";
import { upload } from "../middleware/newMulter";


const router = Router();

// User Sign Up Route
router.post("/signup", signUp_User);

// Host adds a CoHost for an Event 
router.post("/add-cohost", authenticate, AddCoHostNew);

// Cohost accept invite Route 
router.get('/accept-cohost/:id/:token', acceptInvite);

// Cohost decline invite Route 
router.get('/decline-cohost/:id/:token', declineInvite);

// Host cancel invite Route 
router.post('/cancel-invite', authenticate, cancelInvite);

// Host can disable a coHost
router.post('/disable-cohost/:coHostId', authenticate, disableCoHost);

// Host can update a coHost details
router.put('/update-cohost/:coHostId', authenticate, updateCoHost);

// Host fetch all Cohost Route 
router.get('/view-cohosts/:eventId', authenticate, getAllCoHosts);

// Host remove Cohost from an Event Route 
router.put('/remove-cohost/:coHostId/:eventId', authenticate, removeCoHost);

// Host fetch all Cohost Route
router.get('/view-cohosts-for-host/:hostId', authenticate, getAllCoHostsForHost);

// User Login Route
router.post("/login", loginUser);

// Generate refreshToken 
router.post("/refresh-token", refreshTokenGenerate);

// User OTP Verification Route
router.post("/verify-otp", verifyOTP);

// User Email Verification Route 
router.get('/verify-user/:id/:token', verify_Email);

// Resend OTP for User
router.post("/resend-otp", resendOTP);

// Resend OTP forget Password
router.post("/resend-otp-forget", resendOTPForgetPassword);

// User Forgot Password Route
router.post("/forgot-password", forgotPassword);

// User Reset Password Route
router.post("/reset-password", resetPassword);

// User Change Password Route in the settings page
router.put("/change-password", authenticate, changePassword);

// Sign Out Route for User
router.post("/signout", authenticate, signOut);

// Get all User profile
router.get("/profile", getAllUserProfiles);

// Get User Profile by email (User Only)
router.post("/profile", authenticate, getUserProfile);

// Update User Profile Route (Host)
router.put("/update-profile/:hostId", authenticate, updateUserProfile);

// upload a photo for User (Host)
router.put("/upload-photo/:hostId", upload.single('imageUrl'), authenticate, uploadAPhoto);

// Delete User by ID (User Only)
router.delete("/delete-User/:id", authenticate, deleteUserProfile);

// Upload a photo for User
// router.put("/upload-photo-User", upload.single('imageUrl'), authenticate, uploadAPhoto);

// User Profile
router.post("/profile-details", userProfile);

// Fetch the user (Host or CoHost details) using UserID
router.get("/view-user/:userId", getUserDetails);

// Update the user (Host or CoHost details) using UserID
router.put("/update-user/:userId", updateUserDetails);

// Update Admin User Status 
router.put("/update-host-status", authenticate, authorizeRole('admin'), updateHostUserStatus);

export default router;
