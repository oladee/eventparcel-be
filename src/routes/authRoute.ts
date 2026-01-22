import express, {NextFunction, Request, Response} from "express";
import passport from "passport";
import { socialAuthCallback, userProfile, getContactCallback, } from "../controllers/authController";
import { authenticate } from "../middleware/authentication";

const router = express.Router();

// Google Authentication
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], state: "login" }));
// router.get("/google/callback", passport.authenticate("google", { session: false }), socialAuthCallback);
// router.get("/google/callback", (req: Request, res: Response, next: NextFunction) => {
//     passport.authenticate("google", { session: false }, (err, user, info) => {
//       const state = req.query.state;
  
//       if (state === "login") {
//         return socialAuthCallback(req, res); // your login logic
//       }
  
//       return res.redirect("/auth/failure");
//     })(req, res, next);
//   });

// Facebook Authentication
router.get("/facebook", passport.authenticate("facebook", { scope: ["email"] }));
router.get("/facebook/callback", passport.authenticate("facebook", { session: false }), socialAuthCallback);

// Apple Authentication
router.get("/apple", passport.authenticate("apple"));
router.get("/apple/callback", passport.authenticate("apple", { session: false }), socialAuthCallback);

// Microsoft Authentication
router.get("/microsoft", passport.authenticate("microsoft", { scope: ["user.read"] }));
router.get("/microsoft/callback", passport.authenticate("microsoft", { session: false }), socialAuthCallback);

// User Profile
// router.post("/profile", userProfile);

// Google Contacts Authentication and Contact List
router.get("/google/contacts", passport.authenticate("google-contacts", { 
    session: false,   
    scope: [
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "profile"
    ], 
  state: "contacts" 
}));
// router.get("/google/contacts/callback", passport.authenticate("google-contacts", { failureRedirect: "/auth/failure", session: false }), getContactCallback)
// router.get("/google/contacts/callback", (req: Request, res: Response, next: NextFunction) => {
//     passport.authenticate("google-contacts", { session: false }, (err: Error | null, user: any, info: any) => {
//       const state = req.query.state;
  
//       if (state === "contacts") {
//         return getContactCallback(req, res); // your contact-fetching logic
//       }
  
//       return res.redirect("/auth/failure");
//     })(req, res, next);
//   });

router.get("/google/callback", (req, res, next) => {
  const state = req.query.state;

  if (state === "login") {
    passport.authenticate("google", { session: false }, (err, user, info) => {
      if (err || !user) return res.redirect("/auth/failure");
      req.user = user;
      return socialAuthCallback(req, res);
    })(req, res, next);
  } else if (state === "contacts") {
    passport.authenticate("google-contacts", { session: false }, (err: Error | null, profile: any, info: any) => {
      if (err || !profile) return res.redirect("/auth/failure");
      req.user = profile;
      
  // ✅ Set cookie here using info.accessToken
  if (info?.accessToken) {
    res.cookie("googleAccessToken", info.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

// Redirect to Frontend route
 return res.redirect(`${process.env.CLIENT_URL}/dashboard/share-contact?popUp=true`);
  })(req, res, next);
  } else {
    return res.redirect("/auth/failure");
  }
});

router.get("/fetch-contacts", getContactCallback);




export default router;
