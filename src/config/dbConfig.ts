import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const DB = process.env.MONGO_URI;

export const connectDB = async (): Promise<void> => {
  if (!DB) {
    console.log("MONGO_URI is not defined in the environment variables.");
    return;
  }

  try {
    await mongoose.connect(DB);
    console.log("Connection to database established successfully");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log("Error connecting to database: " + error.message);
    } else {
      console.log("Unknown error occurred while connecting to the database.");
    }
  }
};
