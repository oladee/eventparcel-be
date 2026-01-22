import twilio from "twilio";
import axios from "axios";
import dotenv from "dotenv";
import { termiiClient } from "../config/termiiClient";

// Load environment variables from .env file
dotenv.config();

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0"; // Update with the latest API version
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

// Initialize Twilio client using credentials from environment variables
const TwilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Twilio phone number used for sending SMS and WhatsApp messages
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_MESSAGING_SID = process.env.TWILIO_MESSAGING_SERVICE_SID; // Twilio Messaging Service SID
const TWILIO_WHATSAPP_PHONE_NUMBER = process.env.TWILIO_WHATSAPP_PHONE_NUMBER;

// Termii Credentials 
const TERMII_API_KEY = process.env.TERMII_API_KEY as string;
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || "EventParcel";
const TERMII_WHATSAPP_DEVICE_ID = process.env.TERMII_WHATSAPP_DEVICE_ID!;


export class MessageService {
  /**
   * Sends an SMS to a guest using Twilio.
   * @param phoneNumber - The recipient's phone number (e.g., +234XXXXXXXXXX)
   * @param message - The message content to send.
   * @returns {Promise<boolean>} - Returns true if the message was sent successfully, otherwise false.
   */

  static async sendSMSToGuest(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const formattedPhone = phoneNumber.startsWith("+")
        ? phoneNumber
        : `+${phoneNumber}`;
      await TwilioClient.messages.create({
        body: message,
        // from: TWILIO_PHONE_NUMBER,
        messagingServiceSid: TWILIO_MESSAGING_SID, // Twilio Messaging Service SID
        to: formattedPhone,
      });

      console.log(`✅ SMS sent successfully to ${phoneNumber}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Failed to send SMS to ${phoneNumber}:`, error.message);
      return false;
    }
  }

  static async sendSMSToGuestViaTermii(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const formattedPhone = phoneNumber.startsWith("+")
        ? phoneNumber.slice(1)
        : phoneNumber;

      const payload = {
        to: formattedPhone,
        from: TERMII_SENDER_ID,
        sms: message,
        type: "plain",
        channel: "generic",
        api_key: TERMII_API_KEY,
      };

    const response = await termiiClient.post("/sms/send", payload);
    const { data } = response;

    if (data.code !== "ok") {
      // Force error so catch block handles it
      throw new Error(`Termii error: ${data.message || "Unknown error"}`);
    }

    console.log(`✅ SMS sent successfully to ${formattedPhone}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error sending SMS to ${phoneNumber}:`, error.message);
    return false;
  }
}

  /**
   * Sends a WhatsApp message to a guest using Twilio.
   * @param phoneNumber - The recipient's WhatsApp number (e.g., +234XXXXXXXXXX)
   * @param message - The message content to send.
   * @returns {Promise<boolean>} - Returns true if the message was sent successfully, otherwise false.
   */
  static async sendWhatsAppMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const formattedPhone = phoneNumber.startsWith("+")
        ? phoneNumber
        : `+${phoneNumber}`;
      // Send the WhatsApp message using Twilio
      const response = await TwilioClient.messages.create({
        body: message,
        from: `whatsapp:${TWILIO_WHATSAPP_PHONE_NUMBER}`, // Twilio's registered WhatsApp number
        to: `whatsapp:${formattedPhone}`, // Recipient's WhatsApp number
      });

      // Check if the message was actually sent
      if (
        response.status === "sent" ||
        response.status === "delivered" ||
        response.status === "queued"
      ) {
        console.log(`✅ WhatsApp message sent successfully to ${phoneNumber}`);
        return true;
      } else {
        console.error(
          `❌ Failed to send WhatsApp message to ${phoneNumber}, Status: ${response.status}`
        );
        return false;
      }
    } catch (error: any) {
      console.error(
        `❌ Failed to send WhatsApp message to ${phoneNumber}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * Sends a WhatsApp message using the official WhatsApp API.
   * @param phoneNumber - The recipient's WhatsApp number (e.g., 2348012345678, without '+')
   * @param message - The message content to send.
   * @returns {Promise<boolean>} - Returns true if the message was sent successfully, otherwise false.
   */
  static async sendWhatsAppMessageViaAPI(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phoneNumber, // No `+`, just country code and number
          type: "text",
          text: { body: message },
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`✅ WhatsApp message sent successfully to ${phoneNumber}`);
      return true;
    } catch (error: any) {
      console.error(
        `❌ Failed to send WhatsApp message to ${phoneNumber}:`,
        error.response?.data || error.message
      );
      return false;
    }
  }

  static async sendWhatsAppTemplate(phone: string, templateId: string, templateVars: Record<string, any>): Promise<boolean> {
    const phone_number = phone.startsWith("+") ? phone.slice(1) : phone;
    const payload = {
      phone_number,
      device_id: TERMII_WHATSAPP_DEVICE_ID,
      template_id: templateId,
      api_key: TERMII_API_KEY,
      data: templateVars,
    };
    try {
      const { data } = await termiiClient.post("/send/template", payload);
      if (Array.isArray(data) && data[0]?.code === "ok") {
        console.log("✅ WhatsApp template sent", phone_number);
        return true;
      }
      console.error("❌ WhatsApp template failed:", data);
      return false;
    } catch (err: any) {
      console.error("❌ WhatsApp template error:", err.message);
      return false;
    }
  }

  static async sendWhatsAppFreeForm(phone: string, message: string): Promise<boolean> {
    const to = phone.startsWith("+") ? phone.slice(1) : phone;
    const payload = {
      to,
      from: TERMII_SENDER_ID,
      sms: message,
      type: "plain",
      channel: "whatsapp",
      api_key: TERMII_API_KEY,
    };
    try {
      const { data } = await termiiClient.post("/sms/send", payload);
      if (data.code === "ok") {
        console.log("✅ WhatsApp free-form sent", to);
        return true;
      }
      console.error("❌ WhatsApp free-form failed:", data);
      return false;
    } catch (err: any) {
      console.error("❌ WhatsApp free-form error:", err.message);
      return false;
    }
  }

  // Environment variables (should be in your .env file)
  private static readonly WHATSAPP_API_URL = "https://graph.facebook.com/v22.0";
  private static readonly WHATSAPP_PHONE_ID =
    process.env.WHATSAPP_PHONE_ID || "";
  private static readonly WHATSAPP_ACCESS_TOKEN =
    process.env.WHATSAPP_ACCESS_TOKEN || "";

  /**
   * Improved WhatsApp message sender with better error handling and template support
   * @param phoneNumber - Recipient's number in E.164 format (2348012345678)
   * @param message - For text messages OR template object
   * @param isTemplate - Whether the message is a template
   * @returns Promise with status and optional response data
   */
  static async sendWhatsAppMessageAPI(phoneNumber: string, message: string | TemplateMessage, isTemplate: boolean = false): Promise<{ success: boolean; data?: any; messageId?: string }> {
    try {
      // Validate credentials
      if (!this.WHATSAPP_PHONE_ID || !this.WHATSAPP_ACCESS_TOKEN) {
        throw new Error("WhatsApp API credentials not configured");
      }

      // Prepare the request body
      const requestBody: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
      };

      if (isTemplate) {
        requestBody.type = "template";
        requestBody.template = message;
      } else {
        requestBody.type = "text";
        requestBody.text = { body: message };
      }

      // Make the API request
      const response = await axios.post(
        `${this.WHATSAPP_API_URL}/${this.WHATSAPP_PHONE_ID}/messages`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${this.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          timeout: 5000, // 5-second timeout
        }
      );

      const messageId = response.data.messages?.[0]?.id;
      console.log(`✅ Message sent with ID: ${messageId}`);

      console.log(
        `✅ WhatsApp ${
          isTemplate ? "template" : "message"
        } sent to ${phoneNumber}`
      );
      return { success: true, data: response.data, messageId: messageId };
    } catch (error: any) {
      const errorData = error.response?.data || error;
      console.error(
        `❌ Failed to send WhatsApp message to ${phoneNumber}:`,
        errorData
      );

      return {
        success: false,
        data: errorData,
      };
    }
  }
}

// Types for template messages
interface TemplateMessage {
  name: string;
  language: {
    code: string;
  };
  components?: {
    type: string;
    parameters: {
      type: string;
      text: string;
    }[];
  }[];
}

// Example usage:
// For text message: WhatsAppService.sendWhatsAppMessage("2348012345678", "Hello World!")
// For template: WhatsAppService.sendWhatsAppMessage("2348012345678", { name: "welcome_template", language: { code: "en_US" } }, true)

export default MessageService;
