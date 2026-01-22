// import "express-session";
// import "express";

// declare global {
//   namespace Express {
//     interface Request {
//       fileValidationError?: string;
//     }
//   }
// }

// export {};

// declare module "express-session" {
//   interface SessionData {
//     googleAccessToken?: string;  // Add googleAccessToken to SessionData
//   }
// }

// declare module "express-serve-static-core" {
//   interface Request {
//     session?: Express.Session; // mark optional if not always present
//     user?: any; // Replace `any` with your actual user type if you have one
//     rawBody?: any; // Add rawBody to the Request type
//   }
// }



// src/@types/express/index.d.ts
import "express";
import "express-session";

declare global {
  namespace Express {
    interface Request {
      fileValidationError?: string;  // Your Multer validation error
      session?: Session;             // Optional session
      user?: any;                    // Replace `any` with your user type if you have one
      rawBody?: any;                 // Optional rawBody for webhook requests
    }
  }
}

declare module "express-session" {
  interface SessionData {
    googleAccessToken?: string;      // Optional Google Access Token in session
  }
}
