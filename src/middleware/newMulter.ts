// import express, { Request } from "express";
// import path from "path";
// import multer, { FileFilterCallback, StorageEngine } from "multer";
// import dotenv from "dotenv";

// dotenv.config();

// const storage: StorageEngine = multer.diskStorage({
//   destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void): void => {
//     // Use environment variable for upload path, with fallback to '/tmp'
//     // const uploadPath = process.env.UPLOAD_PATH || '/tmp';
//     const uploadPath = path.join(__dirname, "../tmp");
//     cb(null, uploadPath);
//   },
//   filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void): void => {
//     // Use the original filename for saving uploaded file
//     cb(null, file.originalname);
//   }
// });

// const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
//   // Allow images, PDF, and DOC/DOCX file types
//   if (file.mimetype.startsWith("image/")) {
//     cb(null, true);
//   } else if (
//     file.mimetype === "application/pdf" ||
//     file.mimetype === "application/msword" ||
//     file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//   ) {
//     cb(null, true);
//   } else {
//     // Reject unsupported file types
//     cb(new Error("Filetype not supported. Only images, PDF, and DOC/DOCX files are allowed"));
//   }
// };

// // Set file size limit to 10 MB
// const fileSizeLimit = 1024 * 1024 * 10;

// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: fileSizeLimit }
// });

// export { upload };



// import express, { Request } from "express";
// import path from "path";
// import fs from "fs";
// import multer, { FileFilterCallback, StorageEngine } from "multer";
// import dotenv from "dotenv";

// dotenv.config();

// // Define the upload directory outside `src`
// const uploadPath = path.join(__dirname, "../tmp");

// // Ensure the `/tmp` directory exists
// if (!fs.existsSync(uploadPath)) {
//   fs.mkdirSync(uploadPath, { recursive: true });
// }

// const storage: StorageEngine = multer.diskStorage({
//   destination: (req: Request, file: Express.Multer.File, cb) => {
//     cb(null, uploadPath);
//   },
//   filename: (req: Request, file: Express.Multer.File, cb) => {
//     // Generate unique filename (timestamp + original name)
//     const uniqueName = `${Date.now()}-${file.originalname}`;
//     cb(null, uniqueName);
//   },
// });

// const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
//   // Allow only images (JPEG, PNG, WEBP)
//   if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error("Only images (JPEG, PNG, WEBP) are allowed!"));
//   }
// };

// // Set file size limit to 10MB
// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 10 * 1024 * 1024 },
// });

// export { upload };


import express, { Request } from "express";

// Extend the Request interface to include fileValidationError
declare module 'express-serve-static-core' {
  interface Request {
    fileValidationError?: string;
  }
}
import path from "path";
import fs from "fs";
import multer, { FileFilterCallback, StorageEngine } from "multer";
import dotenv from "dotenv";

dotenv.config();

// Ensure the `tmp` directory is always available
const uploadPath = path.join(__dirname, "../../tmp");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage: StorageEngine = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, uploadPath);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename (timestamp + original name)
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (["image/jpeg", "image/png"].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, true);  // Allow the file to continue processing
    req.fileValidationError = "Only images (JPEG, PNG) are allowed!";
  }
};

// Set file size limit to 10MB
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// **✅ Ensure the file exists before attempting to delete it**
export const deleteUploadedFile = (filePath: string) => {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`✅ File deleted: ${filePath}`);
    } catch (error) {
      console.error(`❌ Error deleting file: ${filePath}`, error);
    }
  } else {
    console.warn(`⚠️ File not found: ${filePath}`);
  }
};

export { upload };

