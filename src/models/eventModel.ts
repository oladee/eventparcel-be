import mongoose, { Schema, Document } from "mongoose";
import { IEvent, IEventGroup, IPackage, IGuestTracking } from "../interfaces/modelInterface";
import { SmsLinkModel } from "./smsLinkModel";
import { packageSizeWeight } from "../interfaces/interface";


// Event Schema and Model
const EventSchema: Schema = new Schema(
  {
    eventName: {
      type: String,
      required: true,
    },
    eventImgUrl: {
      type: String,
    },
    eventImgPublicId: {
      type: String,
    },
    eventDescription: {
      type: String,
    },
    eventGroups: [
      {
        type: Schema.Types.ObjectId,
        ref: "EventGroup",
      },
    ],
    user: {
      type: Schema.Types.ObjectId,
      ref: "Host",
    },
    temporaryUserId: {
      type: String,
    },
    date: {
      type: String,
    },
    time: {
      type: String,
    },
    eventLocation: {
      type: String,
    },
    numberOfGroups: {
      type: Number,
      default: 1,
    },
    hostFirstName: {
      type: String,
    },
    hostLastName: {
      type: String,
    },
    hostEmail: {
      type: String,
    },
    coHost: [{
      type: Schema.Types.ObjectId,
      ref: "CoHost"
    }],
    isDisabled: {
      type: Boolean,
      default: false,
    },
    isDraft: {
      type: Boolean,
      default: false,
    },
    isNairaAccount: {
      type: Boolean,
      default: false,
    },
    isDollarAccount: {
      type: Boolean,
      default: false,
    },
    isPickUp: {
      type: Boolean,
      default: false,
    },
    isSelfManaged: {
      type: Boolean,
      default: false,
    },
    isPlatformDelivery: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

EventSchema.pre("findOneAndDelete", async function (next) {
  const eventId = this.getFilter()._id;

  try {
    // Find all event groups under this event
    const eventGroups = await EventGroup.find({ group: eventId });
    const eventGroupIds = eventGroups.map((group) => group._id);

    // Delete all packages under these event groups
    await Package.deleteMany({ eventGroup: { $in: eventGroupIds } });

    // Delete the event groups
    await EventGroup.deleteMany({ event: eventId });

    // Delete all SMSlink tokens associated with this event
    await SmsLinkModel.deleteMany({ eventId });

    next();
  } catch (error: any) {
    next(error);
  }
});

export const Event = mongoose.model<IEvent>("Event", EventSchema);



// Event Group Schema and Model
const EventGroupSchema: Schema = new Schema(
  {
    groupName: {
      type: String,
      required: true,
      trim: true,
    },
    groupDescription: {
      type: String,
    },
    groupCurrency: {
      type: String,
      required: true,
      uppercase: true,
    },
    groupPrivacy: {
      type: String,
      required: true,
      enum: ["general", "private"],
      default: "private",
    },
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
    },
    packages: [
      {
        type: Schema.Types.ObjectId,
        ref: "Package",
      },
    ],
    isDisabled: {
      type: Boolean,
      default: false,
    },
    link: {
      type: String,
    },
    contacts: [
      {
        type: Schema.Types.ObjectId,
        ref: "GuestTracking",
      },
    ],
    isDraft: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

EventGroupSchema.pre("findOneAndDelete", async function (next) {
  const eventGroupId = this.getFilter()._id;

  try {
    // Delete all packages under this event group
    await Package.deleteMany({ eventGroup: eventGroupId });

    // Remove the event group reference from the Event collection
    await Event.updateOne(
      { eventGroups: eventGroupId }, // Find the event that has this event group
      { $pull: { eventGroups: eventGroupId } } // Remove the reference
    );

    next();
  } catch (error: any) {
    next(error);
  }
});

export const EventGroup = mongoose.model<IEventGroup>("EventGroup", EventGroupSchema);



// Package Schema and Model
const PackageSchema: Schema = new Schema(
  {
    eventGroup: {
      type: Schema.Types.ObjectId,
      ref: "EventGroup",
    },
    packageImgUrls: [
      {
        type: String,
      },
    ],
    packageImgPublicIds: [
      {
        type: String,
      },
    ],
    packageTitle: {
      type: String,
      required: true,
    },
    packageDescription: {
      type: String,
    },
    packagePriceCurrency: {
      type: String,
      required: true,
      uppercase: true,
    },
    packagePrice: {
      type: Number,
      required: true,
    },
    packageQuantity: {
      type: Number,
      default: null,
    },
    packageDelivery: {
      type: [String],
      required: true,
    },
    packageSize: {
      type: Number,
      // enum: ["smallBox", "mediumBox", "largeBox", "extraLargeBox" ]
    },
    packageStatus: {
      type: String,
      enum: ["draft", "active", "archived", "deleted"],
      default: "draft",
    },
    isDraft: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

PackageSchema.pre("findOneAndDelete", async function (next) {
  const packageId = this.getFilter()._id;

  try {
    // Remove the package reference from the Event Group collection
    await EventGroup.updateOne(
      { packages: packageId }, // Find the event group that has this package
      { $pull: { packages: packageId } } // Remove the reference
    );

    next();
  } catch (error: any) {
    next(error);
  }
});

export const Package = mongoose.model<IPackage>("Package", PackageSchema);
