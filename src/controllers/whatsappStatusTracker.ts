interface MessageStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
}

export class StatusTracker {
  private statusMap = new Map<string, MessageStatus>();

  updateStatus(messageId: string, status: MessageStatus['status']) {
    this.statusMap.set(messageId, {
      messageId,
      status,
      timestamp: new Date()
    });
  }

  getStatus(messageId: string) {
    return this.statusMap.get(messageId);
  }
}



// // src/whatsapp/statusTracker.ts
// interface MessageStatus {
//   messageId: string;
//   status: 'sent' | 'delivered' | 'read' | 'failed';
//   timestamp: Date;
// }

// export class StatusTracker {
//   private statusMap = new Map<string, MessageStatus>();

//   updateStatus(messageId: string, status: MessageStatus['status']) {
//     this.statusMap.set(messageId, {
//       messageId,
//       status,
//       timestamp: new Date()
//     });
//   }

//   getStatus(messageId: string) {
//     return this.statusMap.get(messageId);
//   }
// }

// // Usage:
// const tracker = new StatusTracker();
// whatsappWebhook.onStatusUpdate = (statuses) => {
//   statuses.forEach(status => {
//     tracker.updateStatus(status.id, status.status);
//   });
// };