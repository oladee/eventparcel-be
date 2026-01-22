import express, { Request } from "express";
import multer, { FileFilterCallback, StorageEngine } from "multer";

const storage: StorageEngine = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void): void => {
    cb(null, "./uploaded");
  },

  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void): void => {
    cb(null, file.originalname);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else if (
    file.mimetype === "application/pdf" ||
    file.mimetype === "application/msword" ||
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Filetype not supported. Only images, PDF, and DOC/DOCX files are allowed"));
  }
};

const fileSize = 1024 * 1024 * 10; // 10 MB file size limit

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: fileSize }
});

export { upload };
