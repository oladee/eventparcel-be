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
  if (file.mimetype === "text/csv" ) {
    cb(null, true);
  } else {
    cb(null, true);  // Allow the file to continue processing
    req.fileValidationError = "Only CSV file is allowed!";
  }
};

// Set file size limit to 10MB
const csvUpload = multer({
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

export { csvUpload };

