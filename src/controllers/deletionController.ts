import mongoose from 'mongoose';
import { User, Host, CoHost, Admin, SuperAdmin } from '../models/userModel';
import { Event, EventGroup, Package } from "../models/eventModel";
import { OrderModel } from '../models/orderModel';
import { DiscountModel } from '../models/discountModel';
import { ActivityLogModel } from '../models/activityLogModel';
import { notificationModel } from '../models/notificationModel';
import { PaymentAndDeliveryModel } from '../models/paymentDeliveryModel';
import { PaymentModel } from '../models/paymentModel';
import { SmsLinkModel } from '../models/smsLinkModel';
import { Request, Response } from 'express';

async function deleteUserAccountByEmail(userEmail: string) {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // 1. Find the user by email
      const user = await User.findOne({ email: userEmail }).session(session);
      
      if (!user) {
        throw new Error(`User with email ${userEmail} not found`);
      }

      const userId = user._id;

      // 2. Find all events created by this user (using hostEmail)
      const userEvents = await Event.find({ hostEmail: userEmail }).session(session);
      const eventIds = userEvents.map(event => event._id);

      // 3. Get all event groups and packages for these events
      const eventGroups = await EventGroup.find({ event: { $in: eventIds } }).session(session);
      const eventGroupIds = eventGroups.map(group => group._id);
      
      const packages = await Package.find({ eventGroup: { $in: eventGroupIds } }).session(session);
      const packageIds = packages.map(pkg => pkg._id);

      // 4. Delete all related data in the correct order

      // A. Delete payments (only by hostId, not guestEmail)
      await PaymentModel.deleteMany({ 
        hostId: userId 
      }).session(session);

      // B. Delete orders (only by hostId, not guestEmail)
      await OrderModel.deleteMany({
        hostId: userId
      }).session(session);

      // C. Delete discounts
      await DiscountModel.deleteMany({ hostId: userId }).session(session);

      // D. Delete activity logs
      await ActivityLogModel.deleteMany({ 
        $or: [
          { user: userId },
          { event: { $in: eventIds } }
        ]
      }).session(session);

      // E. Delete notifications
      await notificationModel.deleteMany({ 
        user: userId
      }).session(session);

      // F. Delete payment and delivery info
      await PaymentAndDeliveryModel.deleteMany({ 
        user: userId
      }).session(session);

      // G. Delete SMS links
      await SmsLinkModel.deleteMany({ 
        eventId: { $in: eventIds } 
      }).session(session);

      // H. Delete packages manually (to ensure they're deleted)
      await Package.deleteMany({ 
        eventGroup: { $in: eventGroupIds } 
      }).session(session);

      // I. Delete event groups manually
      await EventGroup.deleteMany({ 
        event: { $in: eventIds } 
      }).session(session);

      // J. Delete events by hostEmail (this handles both authenticated and unauthenticated events)
      await Event.deleteMany({ 
        hostEmail: userEmail 
      }).session(session);

      // K. Remove user from cohost arrays in other events
      await Event.updateMany(
        { 'coHost': userId },
        { $pull: { coHost: userId } }
      ).session(session);

      // L. Remove cohost references from other hosts
      await User.updateMany(
        { 'eventCoHosts.event': { $in: eventIds } },
        { $pull: { eventCoHosts: { event: { $in: eventIds } } } }
      ).session(session);

      // M. Finally delete the user account
      await User.findByIdAndDelete(userId).session(session);

      console.log(`Successfully deleted user ${userEmail} and all related data`);
      console.log(`Deleted: ${eventIds.length} events, ${eventGroupIds.length} groups, ${packageIds.length} packages`);
    });

    return { success: true, message: 'User account and all related data deleted successfully' };

  } catch (error: any) {
    console.error('Error deleting user account:', error);
    return { 
      success: false, 
      message: 'Failed to delete user account', 
      error: error.message 
    };
  } finally {
    session.endSession();
  }
}

// // Alternative: Delete function that accepts userId instead of email
// async function deleteUserAccountById(userId: string) {
//   const session = await mongoose.startSession();
  
//   try {
//     await session.withTransaction(async () => {
//       // 1. Find the user by ID to get their email
//       const user = await User.findById(userId).session(session);
      
//       if (!user) {
//         throw new Error(`User with ID ${userId} not found`);
//       }

//       const userEmail = user.email;

//       // 2. Continue with the same deletion logic as above...
//       // [Same logic as deleteUserAccountByEmail function]
      
//       // ... rest of the deletion code

//     });

//     return { success: true, message: 'User account deleted successfully' };

//   } catch (error: any) {
//     console.error('Error deleting user account:', error);
//     return { success: false, message: error.message };
//   } finally {
//     session.endSession();
//   }
// }

// Express Route Handler
export const deleteUserAccountHandler = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Optional: Add authorization check
    // if (req.user.email !== email && !req.user.isAdmin) {
    //   return res.status(403).json({ error: 'Unauthorized' });
    // }

    const result = await deleteUserAccountByEmail(email.toLowerCase());

    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      res.status(500).json({ error: result.message });
    }

  } catch (error) {
    console.error('Error in delete route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



// Utility function to check what data will be deleted (for confirmation)
async function getUserDataSummary(userEmail: string) {
  try {
    const user = await User.findOne({ email: userEmail.toLowerCase() });
    
    const events = await Event.find({ hostEmail: userEmail.toLowerCase() });
    const eventIds = events.map(event => event._id);

    const eventGroups = await EventGroup.find({ event: { $in: eventIds } });
    const eventGroupIds = eventGroups.map(group => group._id);

    const summary = {
      user: user || { email: userEmail, note: 'User not found in database (might have unauthenticated events)' },
      events: {
        count: events.length,
        eventIds: eventIds
      },
      eventGroups: {
        count: eventGroups.length,
        groupIds: eventGroupIds
      },
      packages: await Package.countDocuments({ eventGroup: { $in: eventGroupIds } }),
      orders: await OrderModel.countDocuments({ hostId: user?._id }),
      payments: await PaymentModel.countDocuments({ hostId: user?._id }),
      discounts: await DiscountModel.countDocuments({ 
        $or: [
          { hostId: user?._id },
          { event: { $in: eventIds } }
        ]
      }),
      activityLogs: await ActivityLogModel.countDocuments({ 
        $or: [
          { user: user?._id },
          { event: { $in: eventIds } }
        ]
      }),
      notifications: await notificationModel.countDocuments({ user: user?._id }),
      paymentAndDelivery: await PaymentAndDeliveryModel.countDocuments({ 
        $or: [
          { user: user?._id },
          { event: { $in: eventIds } }
        ]
      }),
      smsLinks: await SmsLinkModel.countDocuments({ eventId: { $in: eventIds } })
    };

    return summary;

  } catch (error: any) {
    console.error('Error getting user data summary:', error);
    return { error: error.message };
  }
}


export const getUserDataSummaryHandler = async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email query parameter is required' });
    }
    const summary = await getUserDataSummary(email.toLowerCase());
    if ('error' in summary) {
      return res.status(404).json({ error: summary.error });
    }
    res.status(200).json(summary);
  } catch (error) {
    console.error('Error in summary route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Clean unverified users created more than 5 days ago
async function cleanUnverifiedUsers() {
  const session = await mongoose.startSession();
  
  try {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    
    // Find unverified users created more than 5 days ago
    const unverifiedUsers = await User.find({
      isVerified: false,
      createdAt: { $lt: fiveDaysAgo }
    }).session(session);

    let deletedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    console.log(`Found ${unverifiedUsers.length} unverified users older than 5 days to clean up`);

    for (const user of unverifiedUsers) {
      try {
        const result = await deleteUserAccountByEmail(user.email);
        if (result.success) {
          deletedCount++;
          console.log(`Successfully cleaned up unverified user: ${user.email}`);
        } else {
          errorCount++;
          errors.push(`Failed to delete ${user.email}: ${result.message}`);
          console.error(`Failed to clean up ${user.email}: ${result.message}`);
        }
      } catch (error: any) {
        errorCount++;
        errors.push(`Error deleting ${user.email}: ${error.message}`);
        console.error(`Error cleaning up ${user.email}:`, error);
      }
    }

    return {
      success: true,
      message: `Cleaned up ${deletedCount} unverified users. ${errorCount} errors occurred.`,
      deletedCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error: any) {
    console.error('Error cleaning unverified users:', error);
    return {
      success: false,
      message: 'Failed to clean unverified users',
      error: error.message,
      deletedCount: 0,
      errorCount: 1
    };
  } finally {
    session.endSession();
  }
}

// Express Route Handler for cleaning unverified users
export const cleanUnverifiedUsersHandler = async (req: Request, res: Response) => {
  try {

    const result = await cleanUnverifiedUsers();

    if (result.success) {
      res.status(200).json({
        message: result.message,
        deletedCount: result.deletedCount,
        errorCount: result.errorCount,
        errors: result.errors
      });
    } else {
      res.status(500).json({
        error: result.message,
        details: result.error
      });
    }

  } catch (error) {
    console.error('Error in clean unverified users route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


export { deleteUserAccountByEmail, getUserDataSummary };