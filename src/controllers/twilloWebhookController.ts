import { Request, Response } from "express";


// Twilio SMS Webhook Controller
export const TwilioSMSwebhook = async (req: Request, res: Response): Promise<Response | undefined> => {

    const {
      MessageSid,
      MessageStatus,
      To,
      From,
      ErrorCode,
      ErrorMessage
    } = req.body;
  
    console.log('📦 Twilio Delivery Report:');
    console.log(`SID: ${MessageSid}`);
    console.log(`To: ${To}`);
    console.log(`From: ${From}`);
    console.log(`Status: ${MessageStatus}`);
    if (ErrorCode) {
      console.error(`Error ${ErrorCode}: ${ErrorMessage}`);
    }
  
  
    return res.sendStatus(200); // Twilio expects 200 OK
  };