// src/whatsapp/webhook/whatsappWebhook.ts
import { Request, Response } from 'express';
import { HmacSHA256, enc } from 'crypto-js';

// Configuration interface
export interface WhatsAppWebhookConfig {
  verifyToken: string;
  appSecret?: string;
  onMessage?: (message: any) => void;
  onStatusUpdate?: (status: any) => void;
}

export class WhatsAppWebhook {
  private verifyToken: string;
  private appSecret?: string;
  private onMessage: (message: any) => void;
  private onStatusUpdate: (status: any) => void;

  constructor(config: WhatsAppWebhookConfig) {
    this.verifyToken = config.verifyToken;
    this.appSecret = config.appSecret;
    this.onMessage = config.onMessage || (() => {});
    this.onStatusUpdate = config.onStatusUpdate || (() => {});
  }

  // Handle verification challenge
  verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === this.verifyToken) {
      console.log('✅ Webhook verified');
      return res.status(200).send(challenge);
    }

    console.log('❌ Verification failed - Invalid token');
    return res.sendStatus(403);
  }

  // Process incoming events
  handleWebhook(req: Request, res: Response) {
    // Verify signature if appSecret is provided
    if (this.appSecret) {
      const signature = req.headers['x-hub-signature-256']?.toString() || '';
      const expectedSignature = `sha256=${
        HmacSHA256(JSON.stringify(req.body), this.appSecret).toString(enc.Hex)
      }`;

      if (signature !== expectedSignature) {
        console.log('❌ Invalid signature');
        return res.sendStatus(403);
      }
    }

    // Process WhatsApp events
    const { entry } = req.body;
    entry?.forEach((event: any) => {
      event.changes?.forEach((change: any) => {
        if (change.field === 'messages') {
          const message = change.value.messages[0];
          console.log('📩 New message:', message);
          this.onMessage(message);
        } else if (change.value.statuses /*change.field === 'message_statuses'*/) {
          console.log('🔔 Value update:', change.value);
          console.log('🔔 Status update:', change.value.statuses);
          this.onStatusUpdate(change.value.statuses);
        }
      });
    });

    return res.sendStatus(200);
  }
}


