// import passport from "passport";
// import { Strategy as GoogleStrategy } from "passport-google-oauth20";
// import { Strategy as FacebookStrategy } from "passport-facebook";
// import { Strategy as AppleStrategy } from "passport-apple";
// import { Strategy as MicrosoftStrategy } from "passport-microsoft";
// import jwt from 'jsonwebtoken';
// import dotenv from "dotenv";
// import { User } from "../models/userModel";
// import { Request, Response, NextFunction } from "express";
// import session from 'express-session';

// dotenv.config();

// // Google Strategy
// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID!,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
//       callbackURL: "https://api-eventparcel.onrender.com/auth/google/callback",
//       passReqToCallback: true,
//     },
//     async (
//       req: Request,
//       accessToken: string,
//       refreshToken: string,
//       profile: any,
//       done: (error: any, user?: any) => void
//     ) => {
//       try {
//         // Find user by email and update Google ID if missing
//         let user = await User.findOneAndUpdate(
//           { email: profile.emails?.[0].value }, // Search by email
//           {
//             $setOnInsert: {
//               googleId: profile.id,
//               firstName: profile.name?.givenName || (profile.displayName ? profile.displayName.split(" ")[0] : ""),
//               lastName: profile.name?.familyName || (profile.displayName ? profile.displayName.split(" ")[1] : ""),
//               imageUrl: profile.photos?.[0]?.value,
//               isVerified: true,
//             },
//             $set: { googleId: profile.id }, // Ensure Google ID is updated
//           },
//           { new: true, upsert: true } // Create user if not found
//         );

//         // Generate JWT token
//         const token = jwt.sign(
//           { userId: user._id, email: user.email },
//           process.env.JWT_SECRET as string,
//           { expiresIn: "1d" }
//         );

//         user.token = token;
//         await user.save(); // Save the token

//         done(null, user);
//       } catch (err) {
//         done(err, false);
//       }
//     }
//   )
// );

// // Facebook Strategy
// passport.use(
//     new FacebookStrategy(
//       {
//         clientID: process.env.FACEBOOK_CLIENT_ID!,
//         clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
//         callbackURL: "https://api-eventparcel.onrender.com/auth/facebook/callback",
//         // Ensure we request all necessary fields from Facebook
//         profileFields: ["id", "emails", "name", "displayName", "photos"],
//         passReqToCallback: true, // This gives us access to `req` in the callback
//       },
//       async (
//         req: Request,
//         accessToken: string,
//         refreshToken: string,
//         profile: any,
//         done: (error: any, user?: any) => void
//       ) => {
//         try {
//           // Find user by email and update Facebook ID if missing
//         let user = await User.findOneAndUpdate(
//           { email: profile.emails?.[0].value }, // Search by email
//           {
//             $setOnInsert: {
//               facebookId: profile.id,
//               firstName: profile.name?.givenName || (profile.displayName ? profile.displayName.split(" ")[0] : ""),
//               lastName: profile.name?.familyName || (profile.displayName ? profile.displayName.split(" ")[1] : ""),
//               imageUrl: profile.photos?.[0]?.value,
//               isVerified: true,
//             },
//             $set: { facebookId: profile.id }, // Ensure Facebook ID is updated
//           },
//           { new: true, upsert: true } // Create user if not found
//         );

//         // Generate JWT token
//         const token = jwt.sign(
//           { userId: user._id, email: user.email },
//           process.env.JWT_SECRET as string,
//           { expiresIn: "1d" }
//         );

//         user.token = token;
//         await user.save(); // Save the token

//         done(null, user);
//         } catch (err) {
//           done(err, null);
//         }
//  }));

// // Apple Strategy
// passport.use(new AppleStrategy({
//     clientID: process.env.APPLE_CLIENT_ID!,
//     teamID: process.env.APPLE_TEAM_ID!,
//     keyID: process.env.APPLE_KEY_ID!,
//     privateKeyString: process.env.APPLE_PRIVATE_KEY!,
//     callbackURL: "https://api-eventparcel.onrender.com/auth/apple/callback",
//     passReqToCallback: true,
// }, async (req: Request, accessToken: string, refreshToken: string, profile: any, done: any) => {
//     try {
//                 // Find user by email and update Apple ID if missing
//                 let user = await User.findOneAndUpdate(
//                   { email: profile.emails?.[0].value }, // Search by email
//                   {
//                     $setOnInsert: {
//                       appleId: profile.id,
//                       firstName: profile.name?.givenName || (profile.displayName ? profile.displayName.split(" ")[0] : ""),
//                       lastName: profile.name?.familyName || (profile.displayName ? profile.displayName.split(" ")[1] : ""),
//                       imageUrl: profile.photos?.[0]?.value,
//                       isVerified: true,
//                     },
//                     $set: { appleId: profile.id }, // Ensure Apple ID is updated
//                   },
//                   { new: true, upsert: true } // Create user if not found
//                 );

//                 // Generate JWT token
//                 const token = jwt.sign(
//                   { userId: user._id, email: user.email },
//                   process.env.JWT_SECRET as string,
//                   { expiresIn: "1d" }
//                 );

//                 user.token = token;
//                 await user.save(); // Save the token

//                 done(null, user);
//     } catch (err) {
//         done(err, null);
//     }
// }));

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as AppleStrategy } from "passport-apple";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/userModel";
import { Request } from "express";

dotenv.config();

// Function to generate JWT token
const generateToken = (
  userId: string | mongoose.Types.ObjectId,
  email: string
) => {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET as string, {
    expiresIn: "1d",
  });
};

// Reusable OAuth strategy handler
const handleOAuthLogin = async (
  provider: string,
  profile: any,
  done: (error: any, user?: any) => void
) => {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error(`${provider} login failed: Email not provided.`));
    }

    const user = await User.findOneAndUpdate(
      { email },
      {
        [`${provider}Id`]: profile.id,
        $setOnInsert: {
          firstName: profile.name?.givenName || profile.displayName?.split(" ")[0] || "",
          lastName: profile.name?.familyName || profile.displayName?.split(" ")[1] || "",
          imageUrl: profile.photos?.[0]?.value || "",
          role: "host",
          status: "active",
          isVerified: true,
        },
      },
      { new: true, upsert: true }
    );

    // Fill missing defaults only if they’re not already set
    let updated = false;

    if (!user.role) {
      user.role = "host";
      updated = true;
    }

    if (!user.status) {
      user.status = "active";
      updated = true;
    }

    if (!user.isVerified) {
      user.isVerified = true;
      updated = true;
    }

    if (updated) await user.save();

    // console.log("Created User Object: ", JSON.stringify(user, null, 2));

    // Generate JWT token
    user.accessToken = generateToken(
      user._id as mongoose.Types.ObjectId,
      user.email
    );

    done(null, user);
  } catch (err) {
    done(err, null);
  }
};

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "https://api.eventparcel.com/auth/google/callback",
      passReqToCallback: true,
    },
    (req, accessToken, refreshToken, profile, done) =>
      handleOAuthLogin("google", profile, done)
  )
);

// Facebook Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      callbackURL:
        "https://api.eventparcel.com/auth/facebook/callback",
      profileFields: ["id", "emails", "name", "displayName", "photos"],
      passReqToCallback: true,
    },
    (req, accessToken, refreshToken, profile, done) =>
      handleOAuthLogin("facebook", profile, done)
  )
);

// Apple Strategy
// passport.use(
//   new AppleStrategy(
//     {
//       clientID: process.env.APPLE_CLIENT_ID!,
//       teamID: process.env.APPLE_TEAM_ID!,
//       keyID: process.env.APPLE_KEY_ID!,
//       privateKeyString: process.env.APPLE_PRIVATE_KEY!,
//       callbackURL: "https://api-eventparcel.onrender.com/auth/apple/callback",
//       passReqToCallback: true,
//     },
//     (req: Request, accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any) => void) => {
//         handleOAuthLogin("apple", profile, done);
//     }
//   )
// );

// Microsoft Strategy (replaces LinkedIn)
passport.use(
  new MicrosoftStrategy(
    {
      clientID: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      callbackURL: "/auth/microsoft/callback",
      scope: ["user.read"],
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: any,
      done: (error: any, user?: any) => void
    ) => {
      try {
        let user = await User.findOne({ microsoftId: profile.id });

        if (!user) {
          user = new User({
            microsoftId: profile.id,
            email: profile.emails?.[0].value,
            firstName:
              profile.name?.givenName ||
              (profile.displayName ? profile.displayName.split(" ")[0] : ""),
            lastName:
              profile.name?.familyName ||
              (profile.displayName ? profile.displayName.split(" ")[1] : ""),
            image: profile.photos?.[0]?.value,
          });
          await user.save();
        }
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// For fetching Google Contacts (not login)
passport.use(
  "google-contacts",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "https://api.eventparcel.com/auth/google/callback",
      scope: [
        "https://www.googleapis.com/auth/contacts.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
        "profile",
      ],
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      // // Ensure req has res attached (e.g., from middleware)
      // const res = req.res;
      // if (res && accessToken) {
      //   res.cookie("googleAccessToken", accessToken, {
      //     httpOnly: true, // Secure cookie that can't be accessed via JavaScript
      //     secure: process.env.NODE_ENV === "production", // Only use cookies over HTTPS in production
      //     sameSite: "none", // or 'None' if frontend and backend are on different domains
      //     maxAge: 24 * 60 * 60 * 1000, // Set cookie expiration (e.g., 1 day)
      //   });
      // }
      // ✅ Pass the accessToken through info argument
      return done(null, profile, { accessToken, refreshToken });
    }
  )
);
// passport.use("google-contacts", new GoogleStrategy(
//   {
//     clientID: process.env.GOOGLE_CLIENT_ID!,
//     clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
//     callbackURL: "https://api-eventparcel.onrender.com/auth/google/contacts/callback",
//     scope: ["https://www.googleapis.com/auth/contacts.readonly"],
//     passReqToCallback: true
//   },
//   async (req, accessToken, refreshToken, profile, done) => {
//     // Just pass token to next step
//     if (req.session) {
//       req.session.googleAccessToken = accessToken;
//     }
//     return done(null, profile);
//   }
// ));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});
