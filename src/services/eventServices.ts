import mongoose, { Types } from "mongoose";
import { IEvent, IEventGroup, IPackage, IPackageDeliveryInfo } from "../interfaces/modelInterface";
import { Event, EventGroup, Package } from "../models/eventModel";
import { OrderItem } from "../interfaces/interface";


export class EventService {
    // Get all events, sorted by creation date (newest first).
    public static getEvents(filter: any = {}): Promise<IEvent[]> {
      return Event.find(filter).sort({ createdAt: -1 })
      .populate({
        path: "eventGroups",
        model: "EventGroup",
        populate: {
          path: "packages",
          model: "Package",
        },
      })
      .populate({
        path: "coHost",
        model: "User",
        select: "firstName lastName email phoneNumber imageUrl role",
      })
        .populate({
          path: "user",
          model: "User",
          select: "firstName lastName email phoneNumber imageUrl role",
        });
    }
  
    // Find an event by ID.
    public static getEventById(id: string): Promise<IEvent | null> {
      return Event.findById(id)      
      .populate({
        path: "eventGroups",
        model: "EventGroup",
        populate: {
          path: "packages",
          model: "Package",
        },
      })
      .populate({
        path: "coHost",
        model: "User",
        select: "firstName lastName email phoneNumber imageUrl role",
      })
        .populate({
          path: "user",
          model: "User",
          select: "firstName lastName email phoneNumber imageUrl role",
        });
    }
  
    // Find an event by a given field, e.g., { eventName: "Conference" }.
    public static getEventByField(query: Partial<IEvent>): Promise<IEvent | null> {
      return Event.findOne(query as any)
      .populate({
        path: "eventGroups",
        model: "EventGroup",
        populate: {
          path: "packages",
          model: "Package",
        },
      })
      .populate({
        path: "coHost",
        model: "User",
        select: "firstName lastName email phoneNumber imageUrl role",
      })
        .populate({
          path: "user",
          model: "User",
          select: "firstName lastName email phoneNumber imageUrl role",
        });
    }
  
    // Create a new event.
    public static async createEvent(values: Record<string, any>): Promise<IEvent> {
      const event = new Event(values);
      await event.save();
      return event;
    }
  
    // Delete an event by its ID.
    public static deleteEventById(id: string): Promise<IEvent | null> {
      return Event.findByIdAndDelete(id);
    }
  
    // Update an event by its ID.
    public static updateEventById(
      id: string,
      values: Record<string, any>,
      newOption: boolean = true
    ): Promise<IEvent | null> {
      return Event.findByIdAndUpdate(id, values, { new: newOption });
    }
  
    // Add a group to an event.
    public static async addGroupToEvent(eventId: string | Types.ObjectId, groupId: string | Types.ObjectId): Promise<IEvent | null> {
      return Event.findByIdAndUpdate(
        eventId,
        { $push: { eventGroups: groupId } },
        { new: true }
      );
    }
  
    // Remove a group from an event.
    public static async removeGroupFromEvent(eventId: string, groupId: string): Promise<IEvent | null> {
      return Event.findByIdAndUpdate(
        eventId,
        { $pull: { eventGroups: groupId } },
        { new: true }
      );
    }

    
    // Count the number of events based on a filter.
    public static async countEvents(filter: any = {}) {
      return Event.countDocuments(filter);
    }


    // Aggregate event data based on filters.
    public static async getEventSummaryByIdOld(eventId: string) {
      const eventObjectId = new mongoose.Types.ObjectId(eventId);
  
      const result = await Event.aggregate([
        { $match: { _id: eventObjectId } },
        {
          $lookup: {
            from: "eventgroups",
            localField: "_id",
            foreignField: "event",
            as: "eventGroups"
          }
        },
        {
          $lookup: {
            from: "orders",
            let: { eventId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$eventId", "$$eventId"] } } },
              {
                $group: {
                  _id: "$deliveryType",
                  count: { $sum: 1 }
                }
              }
            ],
            as: "deliveryStat"
          }
        },
        {
          $lookup: {
            from: "paymentanddeliveries",
            localField: "_id",
            foreignField: "event",
            as: "payoutDetails"
          }
        },
        { $unwind: { path: "$payoutDetails", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,  // Event ID
            eventName: 1, // Event name
            eventImgUrl: 1,
            eventImgPublicId: 1,
            eventDescription: 1,
            user: 1,
            date: 1,
            time: 1,
            eventLocation: 1,
            numberOfGroups: 1,
            coHost: 1,
            isDisabled: 1,
            hostDetails: {
              hostFirstName: "$hostFirstName",
              hostLastName: "$hostLastName",
              hostEmail: "$hostEmail"
            },
            eventGroups: 1,
            payoutDetails: 1,
            deliveryStat: {
              $cond: [
                { $gt: [{ $size: "$deliveryStat" }, 0] },
                {
                  $arrayToObject: {
                    $map: {
                      input: "$deliveryStat",
                      as: "stat",
                      in: {
                        k: "$$stat._id",
                        v: "$$stat.count"
                      }
                    }
                  }
                },
                {
                  homeDelivery: 0,
                  pickUp: 0
                }
              ]
            }
          }
        }
      ]);
  
      return result[0] || null; // return null if no event found
    }



  public static async getEventSummaryById(eventId: string) {
    const eventObjectId = new mongoose.Types.ObjectId(eventId);

    const result = await Event.aggregate([
      { $match: { _id: eventObjectId } },
      {
        $lookup: {
          from: "eventgroups",
          localField: "_id",
          foreignField: "event",
          as: "eventGroups"
        }
      },
      { $unwind: { path: "$eventGroups", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "packages",
          localField: "eventGroups._id",
          foreignField: "eventGroup",
          as: "eventGroups.packages"
        }
      },
      {
        $group: {
          _id: "$_id",
          eventName: { $first: "$eventName" },
          eventImgUrl: { $first: "$eventImgUrl" },
          eventImgPublicId: { $first: "$eventImgPublicId" },
          eventDescription: { $first: "$eventDescription" },
          user: { $first: "$user" },
          date: { $first: "$date" },
          time: { $first: "$time" },
          eventLocation: { $first: "$eventLocation" },
          numberOfGroups: { $first: "$numberOfGroups" },
          coHost: { $first: "$coHost" },
          isDisabled: { $first: "$isDisabled" },
          hostFirstName: { $first: "$hostFirstName" },
          hostLastName: { $first: "$hostLastName" },
          hostEmail: { $first: "$hostEmail" },
          eventGroups: { $push: "$eventGroups" }
        }
      },
      {
        // $lookup: {
        //   from: "orders",
        //   let: { eventId: "$_id" },
        //   pipeline: [
        //     { $match: { $expr: { $eq: ["$eventId", "$$eventId"] } } },
        //     {
        //       $group: {
        //         _id: "$deliveryType",
        //         count: { $sum: 1 }
        //       }
        //     }
        //   ],
        //   as: "deliveryStat"
        // }
        $lookup: {
          from: "orders",
          let: { eventId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$eventId", "$$eventId"] },
                    { $eq: ["$paymentStatus", "paid"] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: "$deliveryType",
                count: { $sum: 1 }
              }
            }
          ],
        as: "deliveryStat"
      }
      },
      {
        $lookup: {
          from: "paymentanddeliveries",
          localField: "_id",
          foreignField: "event",
          as: "payoutDetails"
        }
      },
      { $unwind: { path: "$payoutDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          eventName: 1,
          eventImgUrl: 1,
          eventImgPublicId: 1,
          eventDescription: 1,
          user: 1,
          date: 1,
          time: 1,
          eventLocation: 1,
          numberOfGroups: 1,
          coHost: 1,
          isDisabled: 1,
          hostDetails: {
            hostFirstName: "$hostFirstName",
            hostLastName: "$hostLastName",
            hostEmail: "$hostEmail"
          },
          eventGroups: 1,
          payoutDetails: 1,
          deliveryStat: {
            $cond: [
              { $gt: [{ $size: "$deliveryStat" }, 0] },
              {
                $arrayToObject: {
                  $map: {
                    input: "$deliveryStat",
                    as: "stat",
                    in: {
                      k: "$$stat._id",
                      v: "$$stat.count"
                    }
                  }
                }
              },
              {
                homeDelivery: 0,
                pickUp: 0
              }
            ]
          }
        }
      }
    ]);

    return result[0] || null; // Return null if no event found
  }



  public static async getAllCohostsByHostId (hostId: string) {
  if (!mongoose.Types.ObjectId.isValid(hostId)) {
    throw new Error("Invalid host ID");
  }

  const [host] = await mongoose.model("User").aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(hostId) }
    },
    {
      $project: { email: 1 }
    }
  ]);

  if (!host || !host.email) {
    throw new Error("Host not found");
  }

  const cohosts = await Event.aggregate([
    {
      $match: { hostEmail: host.email }
    },
    {
      $lookup: {
        from: "users",
        localField: "coHost",
        foreignField: "_id",
        as: "cohosts"
      }
    },
    {
      $unwind: "$cohosts"
    },
    {
      $project: {
        eventId: "$_id",
        eventName: 1,
        _id: "$cohosts._id",
        firstName: "$cohosts.firstName",
        lastName: "$cohosts.lastName",
        email: "$cohosts.email",
        phoneNumber: "$cohosts.phoneNumber",
        role: "$cohosts.role",
        hostEmail: "$cohosts.hostEmail",
        coHostInviteStatus: "$cohosts.coHostInviteStatus",
        imageUrl: "$cohosts.imageUrl"
      }
    }
  ]);

  return cohosts;
};


}



export class EventGroupService {
    // Get all event groups, sorted by creation date (newest first).
    public static getEventGroups(filter: any = {}): Promise<IEventGroup[]> {
      return EventGroup.find(filter).sort({ createdAt: -1 })
      .populate({
        path: "packages",
        model: "Package",
        })
        .populate({
          path: "event",
          model: "Event",
        })
        .populate({
          path: "contacts",
          model: "GuestTracking",
        })
    }


    public static getEventGroupsByEventId(eventId: string) {
      return EventGroup.find({ event: eventId })
      .select('groupCurrency') // Only fetch what you need
      .lean(); // Return plain objects, not Mongoose documents
    }

  
    // Find an event group by ID.
    public static getEventGroupById(id: string): Promise<IEventGroup | null> {
      return EventGroup.findById(id)
      .populate({
        path: "packages",
        model: "Package",
        })
        .populate({
          path: "event",
          model: "Event",
        })
        .populate({
          path: "contacts",
          model: "GuestTracking",
        })
    }

    // Find an event group by ID with few selected fields.
    public static getEventGroupByIdFew(id: string): Promise<IEventGroup | null> {
      return EventGroup.findById(id).select("groupName groupDescription event eventImgUrl eventImgPublicId isDisabled")
    }
  
    // Find an event group by a given field, e.g., { groupName: "VIP", event: "8498489jekd40943439" }.
    public static getEventGroupByField(query: any = {}): Promise<IEventGroup | null> {
      return EventGroup.findOne(query as any)
      .populate({
        path: "packages",
        model: "Package",
        })
        .populate({
          path: "event",
          model: "Event",
        })
        .populate({
          path: "contacts",
          model: "GuestTracking",
        })
    }
  
    // Create a new event group.
    public static async createEventGroup(values: Record<string, any>): Promise<IEventGroup> {
      const eventGroup = new EventGroup(values);
      await eventGroup.save();
      return eventGroup;
    }
  
    // Delete an event group by its ID.
    public static deleteEventGroupById(id: string): Promise<IEventGroup | null> {
      return EventGroup.findByIdAndDelete(id);
    }
  
    // Update an event group by its ID.
    public static updateEventGroupById(
      id: string,
      values: Record<string, any>,
      newOption: boolean = true
    ): Promise<IEventGroup | null> {
      return EventGroup.findByIdAndUpdate(id, values, { new: newOption });
    }
  
    // Add a package to an event group.
    public static async addPackageToEventGroup(groupId: string | Types.ObjectId, packageId: string | Types.ObjectId): Promise<IEventGroup | null> {
      return EventGroup.findByIdAndUpdate(
        groupId,
        { $push: { packages: packageId } },
        { new: true }
      );
    }
  
    // Remove a package from an event group.
    public static async removePackageFromEventGroup(groupId: string, packageId: string): Promise<IEventGroup | null> {
      return EventGroup.findByIdAndUpdate(
        groupId,
        { $pull: { packages: packageId } },
        { new: true }
      );
    }
  }




  export class PackageService {
    // Get all packages, sorted by creation date (newest first).
    public static getPackages(filter: any = {}): Promise<IPackage[]> {
      return Package.find(filter).sort({ createdAt: -1 });
    }
  
    // Find a package by ID.
    public static getPackageById(id: string): Promise<IPackage | null> {
      return Package.findById(id);
    }
  
    // Find a package by a given field, e.g., { packageTitle: "Premium", eventGroup: "73487487rehejherj43788487" }.
    public static getPackageByField(query: any = {}): Promise<IPackage | null> {
      return Package.findOne(query as any);
    }
  
    // Create a new package.
    public static async createPackage(values: Record<string, any>): Promise<IPackage> {
      const packagee = new Package(values);
      await packagee.save();
      return packagee;
    }
  
    // Delete a package by its ID.
    public static deletePackageById(id: string): Promise<IPackage | null> {
      return Package.findByIdAndDelete(id);
    }
  
    // Update a package by its ID.
    public static updatePackageById(
      id: string,
      values: Record<string, any>,
      newOption: boolean = true
    ): Promise<IPackage | null> {
      return Package.findByIdAndUpdate(id, values, { new: newOption })
      .populate({
        path: "eventGroup",
        model: "EventGroup",
        populate: {
          path: "event",
          model: "Event",
        },
      })
    }


    // update packages by their IDs
    public static async updatePackagesByIds(
      ids: string[],
      values: Record<string, any>,
      // newOption: boolean = true
    ): Promise<IPackage[]> {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error("Invalid or empty Package IDs array");
      }
      // Validate that all IDs are valid ObjectIds
      const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));

      const updatedPackages = await Package.updateMany(
        { _id: { $in: objectIds } },
        values
      );

      if (updatedPackages.modifiedCount === 0) {
        throw new Error("No packages were updated");
      }

      return Package.find({ _id: { $in: objectIds } });
    }



//     // deduct package quantity
//     public static async deductPackageQuantities (items: OrderItem[]) {
//   try {
//     const updateOps = items.map(item => {
//       if (!item.packageId || !item.quantity) return null;

//       return Package.findByIdAndUpdate(
//         item.packageId,
//         { $inc: { packageQuantity: -item.quantity } },
//         { new: true }
//       );
//     }).filter(Boolean); // filter out any nulls

//     const results = await Promise.all(updateOps);

//     // Optional: Check for packages that went below 5
//     for (const pkg of results) {
//       if (pkg?.packageQuantity !== undefined && pkg.packageQuantity < 5) {
//         console.warn(`Warning: Package ${pkg._id} has negative quantity.`);
//         // You can revert or flag the package here if needed
//       }
//     }

//     return results;
//   } catch (error) {
//     console.error("Error deducting package quantities:", error);
//     throw new Error("Failed to update package quantities.");
//   }
// };


// public static async deductPackageQuantities(items: OrderItem[]) {
//   try {
//     const updateOps = items.map(item => {
//       const packageId = typeof item.packageId === "object" && item.packageId !== null && "_id" in item.packageId
//         ? (item.packageId as { _id: string })._id.toString()
//         : item.packageId?.toString();

//       const quantity = Number(item.quantity);

//       console.log("🧾 PackageId to deduct:", packageId, "Qty:", quantity);

//      // Validate inputs: skip if packageId is invalid or quantity is null/invalid
//       if (!packageId || quantity === null || isNaN(quantity) || quantity <= 0) {
//         console.warn("⏭️ Skipping item due to invalid quantity or packageId:", item);
//         return null;
//       }

//       return Package.findByIdAndUpdate(
//         packageId,
//         { $inc: { packageQuantity: -quantity } },
//         { new: true }
//       );
//     }).filter(Boolean);

//     const results = await Promise.all(updateOps);

//     // Optional: log low stock
//     for (const pkg of results) {
//       if (pkg?.packageQuantity !== undefined && pkg.packageQuantity < 5) {
//         console.warn(`⚠️ Warning: Package ${pkg._id} has low or negative quantity.`);
//       }
//     }

//     return results;
//   } catch (error) {
//     console.error("❌ Error deducting package quantities:", error);
//     throw new Error("Failed to update package quantities.");
//   }
// }

public static async deductPackageQuantities(items: OrderItem[]) {
  try {
    const updateOps = items.map(async (item) => {
      const packageId =
        typeof item.packageId === "object" && item.packageId !== null && "_id" in item.packageId
          ? (item.packageId as { _id: string })._id.toString()
          : item.packageId?.toString();

      const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : null;

      if (!packageId || quantity === null) {
        console.warn("⏭️ Skipping item due to invalid quantity or packageId:", item);
        return null;
      }

      // Fetch the package to check if it has a valid quantity in DB
      const pkg = await Package.findById(packageId).select("packageQuantity packageTitle");

      if (!pkg) {
        console.warn(`⏭️ Skipping: Package not found for ID ${packageId}`);
        return null;
      }

      // If host never set quantity (null or undefined), skip deduction
      if (pkg?.packageQuantity === null || pkg?.packageQuantity === undefined) {
        console.warn(`⏭️ Skipping deduction for package '${pkg.packageTitle}' as it has no defined quantity`);
        return null;
      }

      console.log("🧾 Deducting from PackageId:", packageId, "Qty:", quantity);

      return Package.findByIdAndUpdate(
        packageId,
        { $inc: { packageQuantity: -quantity } },
        { new: true }
      );
    });

    const results = await Promise.all(updateOps);

    // Optional: Log low stock
    for (const pkg of results) {
      if (pkg?.packageQuantity !== undefined && pkg.packageQuantity < 5) {
        console.warn(`⚠️ Warning: Package ${pkg._id} has low or negative quantity.`);
      }
    }

    return results.filter(Boolean); // Remove nulls from skipped items
  } catch (error) {
    console.error("❌ Error deducting package quantities:", error);
    throw new Error("Failed to update package quantities.");
  }
}



public static async getPackagesDeliveryInfoByIds(packageIds: string[] | Types.ObjectId[]): Promise<IPackageDeliveryInfo[]> {
  const objectIds = packageIds.map(id => new Types.ObjectId(id));

  const packages = await Package.find(
    { _id: { $in: objectIds } },
    { _id: 1, packageDelivery: 1, packageTitle: 1 } // projection: only fetch _id and packageDelivery
  ).lean();

  return packages as IPackageDeliveryInfo[]; 
};

  }