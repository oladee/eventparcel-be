import { SmsLinkModel } from "../models/smsLinkModel";
import { ISMSlink } from "../interfaces/modelInterface";
import { generateAlphanumericCode } from "../helpers/helpers";

export class SmsLinkService {
  // Generate a SMS Link for Guest
  static async generateSmsPreviewCode(
    eventId: string,
    groupId: string,
    guestPhoneNumber: string
  ): Promise<string | null> {
    let token: string | undefined;
    let unique = false;

    for (let i = 0; i < 10; i++) {
      const generatedCode = generateAlphanumericCode(8); // You can make this 6–10 chars
      const exists = await SmsLinkModel.findOne({ token: generatedCode });
      if (!exists) {
        token = generatedCode;
        unique = true;
        break;
      }
    }

    if (!unique || !token) {
      throw new Error("Failed to generate a unique preview code.");
    }

    // Save to DB
    await SmsLinkModel.create({
      token,
      eventId,
      groupId,
      guestPhoneNumber,
    });

    return token;
  }

  // Decode link meta data
  static async decodeSmsLink(token: string): Promise<ISMSlink | null> {
    const previewData = await SmsLinkModel.findOne({ token });
    if (!previewData) {
      throw new Error("Invalid or expired link code.");
    }

    return previewData;
  }

  // Delete SMS Link by ID
  static async deleteSmsLinkById(id: string): Promise<ISMSlink | null> {
    return SmsLinkModel.findByIdAndDelete(id);
  }

  // Get SMS Link by ID
  static async getSmsLinkById(id: string): Promise<ISMSlink | null> {
    return SmsLinkModel.findById(id);
  }

  // Get SMS Link by Field
  static async getSmsLinkByField(filter: any = {}): Promise<ISMSlink | null> {
    return SmsLinkModel.findOne(filter);
  }
}
