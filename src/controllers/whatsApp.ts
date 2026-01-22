import express, { Request, Response } from "express";
import dotenv from "dotenv";
import axios from "axios";
import mongoose, { Schema, Document } from "mongoose";

dotenv.config();

const app = express();
app.use(express.json());

// WhatsApp Cloud API credentials
const { WHATSAPP_ACCESS_TOKEN, PHONE_NUMBER_ID, MONGO_URI } = process.env;

// Connect to MongoDB
mongoose
  .connect(MONGO_URI as string)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Connection Error:", err));

// OTP Interface & Schema
interface IOTP extends Document {
  phoneNumber: string;
  otp: string;
  createdAt: Date;
}

const otpSchema = new Schema<IOTP>(
  {
    phoneNumber: { type: String, required: true, unique: true },
    otp: { type: String, required: true },
    createdAt: { type: Date, expires: 300, default: Date.now }, // OTP expires in 5 mins
  },
  { timestamps: true }
);

const OTPModel = mongoose.model<IOTP>("OTP", otpSchema);

// Generate a 6-digit OTP
const generateOTP = (): number => Math.floor(100000 + Math.random() * 900000);

// Send OTP via WhatsApp Cloud API
// app.post("/send-otp", async (req: Request, res: Response) => {
export const whatsappService = async (phoneNumber: string) => {
  try {
    // const { phoneNumber } = req.body;
    if (!phoneNumber) console.log({ message: "Phone number is required" });

    const otp = generateOTP().toString();

    // Store OTP in MongoDB (Update if exists)
    await OTPModel.findOneAndUpdate(
      { phoneNumber },
      { otp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: { body: `Your verification code is: ${otp}` },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(response);

    console.log("OTP sent successfully!")
    // res.status(200).json({ message: "OTP sent successfully", response: response.data });
  } catch (error: any) {
    console.log("Failed to send OTP: ", error.response?.data || error.message )
    // res.status(500).json({ message: "Failed to send OTP", error: error.response?.data || error.message });
  }
};
