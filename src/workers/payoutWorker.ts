// import { Worker, Job } from 'bullmq';
// import { redisConfig } from '../config/redisConfig';
// import { WithdrawalModel } from '../models/withdrawalModel';
// import { WithdrawalService } from '../services/withdrawalServices';
// import { PaymentAndDeliveryModel } from '../models/paymentDeliveryModel';
// import { sendMail } from '../utils/emailHandler/email';
// import { INairaPayout } from '../interfaces/modelInterface';

// // Job data interface
// interface PayoutJobData {
//   hostId: string;
//   hostEmail: string;
//   hostShare: number;
//   currency: string;
//   orderId: string;
// }

// let isRedisAvailable = true;

// export const payoutWorker = new Worker<PayoutJobData>(
//   'instant-payout',
//   async (job: Job<PayoutJobData>) => {
//     const { hostId, hostEmail, hostShare, currency, orderId } = job.data;

//     const alreadyPaid = await WithdrawalModel.findOne({ userId: hostId, orderId });
//     if (alreadyPaid) {
//       console.log(`⚠️ Payout already exists for order ${orderId}`);
//       return { status: 'duplicate', message: `Payout already exists` };
//     }

//     const paymentDetails = await PaymentAndDeliveryModel.findOne({
//       user: hostId,
//       nairaAccount: { $exists: true, $ne: null },
//     });

//     if (!paymentDetails?.nairaAccount) {
//       throw new Error(`Missing bank details for ${hostEmail}`);
//     }

//     const nairaAccount = paymentDetails.nairaAccount as INairaPayout;
//     let { accountName, accountNumber, bankCode, recipientCode } = nairaAccount;

//     if (!recipientCode) {
//       recipientCode = await WithdrawalService.createRecipient(
//         accountName || "", accountNumber || "", bankCode || "", hostEmail
//       );
//       nairaAccount.recipientCode = recipientCode;
//       await paymentDetails.save();
//     }

//     if (!recipientCode) {
//       throw new Error(`Missing recipient code for ${hostEmail}`);
//     }

//     const transferData = await WithdrawalService.initiateWithdrawal(
//       hostId, hostEmail, hostShare, currency, recipientCode
//     );

//     console.log(`✅ Payout initiated for ${hostEmail}: ₦${hostShare / 100} (${transferData.transfer_code})`);

//     return {
//       status: 'success',
//       transferCode: transferData.transfer_code,
//       amount: hostShare,
//       hostEmail
//     };
//   },
//   {
//     connection: redisConfig,
//     concurrency: 5,
//     removeOnComplete: { count: 100 },
//     removeOnFail: { count: 50 },
//   }
// );

// // 🛠 Error & alert handling
// payoutWorker.on('failed', async (job, err) => {
//   if (!job?.data) {
//     console.error('❌ Job failed: Missing data', err);
//     return;
//   }

//   const { hostEmail, hostShare } = job.data;
//   const msg = `❌ Payout Job Failed:
// - Host: ${hostEmail}
// - Amount: ₦${hostShare / 100}
// - Job ID: ${job.id}
// - Attempts: ${job.attemptsMade}/${job.opts.attempts}
// - Reason: ${err.message}`;

//   console.error(msg);

//   if (job.attemptsMade >= (job.opts.attempts || 1)) {
//     try {
//       await sendMail({
//         email: process.env.ADMIN_EMAIL || 'admin@example.com',
//         subject: '🚨 Payout Job Failed - Final Attempt',
//         html: `<p>${msg.replace(/\n/g, '<br>')}</p>`,
//       });
//     } catch (emailError) {
//       console.error('❌ Failed to send admin alert email:', emailError);
//     }
//   }
// });

// payoutWorker.on('completed', (job, result) => {
//   console.log(`✅ Job ${job.id} completed for ${job.data.hostEmail}`);
// });

// payoutWorker.on('stalled', (jobId) => {
//   console.warn(`⚠️ Job ${jobId} stalled`);
// });

// payoutWorker.on('error', (err) => {
//   console.error('❌ Worker error:', err);
// });

// let isShuttingDown = false;

// ['SIGINT', 'SIGTERM'].forEach((signal) => {
//   process.on(signal, async () => {
//     if (isShuttingDown) return;
//     isShuttingDown = true;
//     console.log(`🛑 Received ${signal}, shutting down payout worker...`);
//     await payoutWorker.close();
//     process.exit(0);
//   });
// });




import { Worker, Job } from 'bullmq';
import redisClient, { redisConfig } from '../config/redisConfig';
import { WithdrawalModel } from '../models/withdrawalModel';
import { WithdrawalService } from '../services/withdrawalServices';
import { PaymentAndDeliveryModel } from '../models/paymentDeliveryModel';
import { sendMail } from '../utils/emailHandler/email';
import { INairaPayout } from '../interfaces/modelInterface';
import PaymentService from '../services/paymentServices';

interface PayoutJobData {
  hostId: string;
  hostEmail: string;
  hostShare: number;
  currency: string;
  orderId: string;
}

let isRedisAvailable = true;

export const payoutWorker = new Worker<PayoutJobData>(
  'instant-payout',
  async (job: Job<PayoutJobData>) => {
    const { hostId, hostEmail, hostShare, currency, orderId } = job.data;

    const amountInKobo = Math.floor(hostShare * 100);

    const alreadyPaid = await WithdrawalModel.findOne({ userId: hostId, orderId });
    if (alreadyPaid) {
      console.log(`⚠️ Payout already exists for order ${orderId}`);
      return { status: 'duplicate', message: `Payout already exists` };
    }

    const paymentDetails = await PaymentAndDeliveryModel.findOne({
      user: hostId,
      nairaAccount: { $exists: true, $ne: null },
    });

    if (!paymentDetails?.nairaAccount) {
      throw new Error(`Missing bank details for ${hostEmail}`);
    }

    const balance = await PaymentService.checkPaystackBalance(currency);
    console.log(`💰 Available Paystack Balance: ₦${balance / 100}`);

    if (balance < amountInKobo) {
        throw new Error(`Insufficient Paystack balance. Required: ₦${amountInKobo / 100}, Available: ₦${balance / 100}`);
    }

    const nairaAccount = paymentDetails.nairaAccount as INairaPayout;
    let { accountName, accountNumber, bankCode, recipientCode } = nairaAccount;

    if (!recipientCode) {
      recipientCode = await WithdrawalService.createRecipient(
        accountName || '', accountNumber || '', bankCode || '', hostEmail
      );
      nairaAccount.recipientCode = recipientCode;
      await paymentDetails.save();
    }

    if (!recipientCode) {
      throw new Error(`Missing recipient code for ${hostEmail}`);
    }

    const transferData = await WithdrawalService.initiateWithdrawal(
      hostId, hostEmail, hostShare, currency, recipientCode
    );

    console.log(`✅ Payout initiated for ${hostEmail}: ₦${amountInKobo / 100} (${transferData.transfer_code})`);

    return {
      status: 'success',
      transferCode: transferData.transfer_code,
      amount: amountInKobo,
      hostEmail
    };
  },
  {
    connection: redisConfig,
    lockDuration: 30000,          // Job lock duration
    autorun: true,
    concurrency: 5,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  }
);

// Handle failed jobs
payoutWorker.on('failed', async (job, err) => {
  if (!job?.data) {
    console.error('❌ Job failed: Missing data', err);
    return;
  }

  const { hostEmail, hostShare } = job.data;
  const amountInKobo = Math.floor(hostShare * 100);
  const msg = `❌ Payout Job Failed:
- Host: ${hostEmail}
- Amount: ₦${amountInKobo / 100}
- Job ID: ${job.id}
- Attempts: ${job.attemptsMade}/${job.opts.attempts}
- Reason: ${err.message}`;

  console.error(msg);

  if (job.attemptsMade >= (job.opts.attempts || 1)) {
    try {
      await sendMail({
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        subject: '🚨 Payout Job Failed - Final Attempt',
        html: `<p>${msg.replace(/\n/g, '<br>')}</p>`,
      });
    } catch (emailError) {
      console.error('❌ Failed to send admin alert email:', emailError);
    }
  }
});

// Handle completed jobs
payoutWorker.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed for ${job.data.hostEmail}`);
});

// Handle stalled jobs
payoutWorker.on('stalled', (jobId) => {
  console.warn(`⚠️ Job ${jobId} stalled`);
});

// Handle Redis errors
payoutWorker.on('error', async (err: Error) => {
  console.error('❌ Worker error:', err.message);

  if (err.message.includes('ECONNRESET') || err.message.includes('ECONNREFUSED')) {
    if (isRedisAvailable) {
      isRedisAvailable = false;
      await payoutWorker.pause();
      console.warn('⏸️ Worker paused due to Redis error');

      try {
        await sendMail({
          email: process.env.ADMIN_EMAIL || 'admin@example.com',
          subject: '🚨 Redis Down - Worker Paused',
          html: `<p><strong>Error:</strong> ${err.message}<br/><strong>Action:</strong> Worker has been paused until Redis is restored.</p>`,
        });
      } catch (emailErr) {
        console.error('❌ Failed to notify admin:', emailErr);
      }
    }
  }
});

// Resume worker when Redis comes back
redisClient.on('ready', async () => {
  if (!isRedisAvailable) {
    isRedisAvailable = true;
    await payoutWorker.resume();
    console.log('▶️ Redis restored. Worker resumed.');
  }
});

// Graceful shutdown
let isShuttingDown = false;
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`🛑 Received ${signal}, shutting down payout worker...`);
    await payoutWorker.close();
    process.exit(0);
  });
});
