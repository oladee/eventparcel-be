import { Types, Document } from "mongoose";
import { IPickUpDetails } from "./interface";


export interface IEventCoHosts extends Document {
  event: Types.ObjectId;
  isCoHost: boolean;
  joinedAt: Date;
}


export interface IBaseUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  maskedEmail?: string;
  phoneNumber?: string;
  role: "host" | "cohost" | "admin" | "superAdmin";
  status: "active" | "inactive" | "suspended" | "disabled";
  host?: Types.ObjectId;
  hostEmail?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  password: string;
  isVerified: boolean;
  isCoHostToo?: boolean;
  accessToken?: string | null;
  refreshToken: string[];
  imageUrl?: string | null;
  imagePublicId?: string | null;
  lastLogin: Date;
  lastLoginHistory?: Date[];
  otp?: string;
  otpExpiry?: Date | undefined | null;
  otpAttempts: number;
  isOtpVerified: boolean;
  lastActive?: string;
  isDisabled?: boolean;
  facebookId?: string;
  googleId?: string;
  appleId?: string;
  microsoftId?: string;
  eventCoHosts?: IEventCoHosts[]; // Array of event co-hosts
  createdAt?: Date;
  updatedAt?: Date;
}

// Host-specific fields
export interface IHost extends IBaseUser {
  role: "host"; 
  balance: number;
  usdBalance: number;
  isDisabled: boolean;
  hyperwalletToken?: string;
  isHyperwalletVerified: boolean;
}

// CoHost-specific fields
export interface ICoHost extends IBaseUser {
  role: "cohost"; 
  host: Types.ObjectId;
  hostEmail: string;
  coHostInviteStatus: "pending" | "accepted" | "declined" | "canceled";
}

// Admin-specific fields
export interface IAdmin extends IBaseUser {
  isAdmin: boolean; 
}

// SuperAdmin-specific fields
export interface ISuperAdmin extends IBaseUser {
  isSuperAdmin: boolean;
}
  
export interface IUser extends Document {
    _id: Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    maskedEmail: string;
    phoneNumber: string;
    password: string;
    role: string;
    isVerified: boolean;
    accessToken: string | null;
    refreshToken: string[];
    imageUrl: string | null;
    imagePublicId: string | null;
    lastLogin: Date[];
    otp: string | undefined;
    otpExpiry: any;
    otpAttempts: number;
    isOtpVerified: boolean;
    lastActive: string;
    facebookId: string;
    googleId: string;
    appleId: string;
    microsoftId: string;
    hostEmail: string;
    host: Types.ObjectId | undefined;
    coHostInviteStatus: string;
    balance: number | undefined;
    usdBalance: number | undefined;
    isDisabled: boolean;
    hyperwalletToken?: string;
    isHyperwalletVerified?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }


export interface IEvent extends Document {
  _id: Types.ObjectId;
  eventName: string;
  eventImgUrl: string;
  eventImgPublicId: string;
  eventDescription?: string;
  eventGroups: Types.ObjectId[];
  user: Types.ObjectId;
  temporaryUserId: string;
  date: string;
  time: string;
  eventLocation: string;
  numberOfGroups: number | null | undefined;
  hostFirstName: string;
  hostLastName: string;
  hostEmail: string;
  coHost: Types.ObjectId[];
  isDisabled: boolean;
  isNairaAccount: boolean;
  isDollarAccount: boolean;
  isPickUp: boolean;
  isSelfManaged: boolean;
  isPlatformDelivery: boolean;
  isDraft?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
} 


export interface IEventGroup extends Document {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  groupName: string;
  groupDescription?: string;
  groupCurrency: string;
  groupPrivacy: string;
  event: Types.ObjectId | any;
  packages: Types.ObjectId[];
  isDisabled: boolean;
  link: string;
  contacts: IGuestTracking[];
  isDraft?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}


export interface IPackage extends Document {
  _id: Types.ObjectId;
  eventGroup: Types.ObjectId | IEventGroup;
  packageImgUrls: string[];
  packageImgPublicIds: string[];
  packageTitle: string;
  packageDescription: string;
  packagePriceCurrency: string;
  packagePrice: number;
  packageQuantity?: number;
  packageDelivery: string[];
  packageSize?: number;
  packageStatus?: "draft" | "active" | "archived" | "deleted";
  isDraft?: boolean;
}

export interface IGuestContact extends Document {
  userId: Types.ObjectId;
  guestName: string;
  guestPhoneNumber: string;
}


export interface IContact extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  contacts: IGuestContact[];
}

export interface INairaPayout extends Document {
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
  bankCode?: string;
  recipientCode?: string;
}

export interface IDollarPayout extends Document {
  usAccountNumber?: string;
  routingNumber?: string;
  usBankName?: string;
  usAccountName?: string;
}


export interface IPaymentAndDelivery extends Document {
  _id: Types.ObjectId;
  user?: Types.ObjectId;
  event?: Types.ObjectId;
  nairaAccount?: IDollarPayout | undefined;
  dollarAccount?: IDollarPayout | undefined;
  paymentDate?: string;
  paymentTime?: string;
  paymentTimeZone?: string;
  contactName?: string;
  contactPhoneNumber?: string;
  pickupLocation?: string;
  pickupLatitude?: string;
  pickupLongitude?: string;
  state?: string;
  city?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  deliveryTimeZone?: string;
  isDraft?: boolean;
}


export interface IGuestTracking extends Document {
    guestName: string;
    phoneNumber: string;
    eventGroupId: Types.ObjectId;
    eventId: Types.ObjectId;
    hostId: Types.ObjectId;
    inviteLink: string;
    hasViewed: boolean;
    status: "pending" | "viewed" | "ordered";
    viewedAt?: Date;
    createdAt?: Date;
}


export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderId: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhoneNumber: string;
  hostId: Types.ObjectId;
  eventId: Types.ObjectId | any;
  eventGroupId: Types.ObjectId | any;
  items: IOrderItem[];
  discountCode: string;
  itemTotal: number;
  totalAmount: number;
  totalAmountCurrency: "USD" | "NGN";
  shippingAddress: string;
  addressLatitude?: string;
  addressLongitude?: string;
  state: string;
  city: string;
  dispatchType: string;
  deliveryType: string;
  homeDeliveryFee: number | undefined;
  discount: number | undefined;
  txnFee: number | undefined;
  tax: number;
  trackingId?: string | undefined;
  trackingUrl?: string;
  paymentStatus: "processing" | "pending" | "paid";
  orderStatus: "pending" | "shipped" | "delivered" | "pickedUp" | "attempted";
  shippedAt: Date;
  deliveredAt: Date;
  pickedUpAt?: Date;
  pickUpDetails?: IPickUpDetails;
  createdAt?: Date;
  updatedAt?: Date;
  reprocess?: boolean;
}

export interface IOrderItem extends Document {
  packageId: Types.ObjectId | IPackage;
  packageImgUrls: string[];
  packageImgPublicIds: string[];
  packageTitle: string;
  packageDescription?: string;
  packagePriceCurrency: string;
  packagePrice: number;
  quantity: number;
  deliveryMethod: string | null;
  packageDeliveryType: string[];
  packageSize: string | null;
}


export interface IPackageDeliveryInfo {
  _id: any;
  packageDelivery: string[];
  packageTitle: string;
}



export interface IPayment extends Document {
  _id: Types.ObjectId;
  hostId: Types.ObjectId;
  orderId: Types.ObjectId;
  guestEmail: string;
  amount: number;
  currency: string;
  order?: any;
  paymentStatus: "pending" | "paid" | "failed" | "dispute" | "refund";
  paymentReference: string;
  transactionFee?: number | undefined;
  platformFee?: number | undefined;
  hostShare?: number | undefined;
  type: string;
  createdAt?: Date;
  updatedAt?: Date;
}


export interface IWithdrawal extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  reference: string;
  email: string;
  amount: number;
  currency: string;
  withdrawalStatus: "pending" | "completed" | "failed";
  transferId: string;
  orderId?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}


export interface INotification extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  userType: string;
  email: string;
  subject: string;
  message: string;
  time: string;
  date: string;
  createdAt?: Date;
  updatedAt?: Date;
}


export interface IDiscount extends Document {
  _id: Types.ObjectId;
  event: Types.ObjectId;
  hostId: Types.ObjectId;
  discountTitle: string;  
  discountValue: number;  
  discountValueType: "percentage" | "NGN" | "USD";
  discountCode: string;
  discountStatus: "active" | "inactive";
  totalUsed: number;
  overallValue: number;
  createdAt?: Date;
  updatedAt?: Date;
}


export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  event?: Types.ObjectId;
  group?: Types.ObjectId | null | undefined;
  action: string;                     // e.g., "Imported Contacts", "Created a Group"
  actionType?: string;
  entity: string;                     // e.g., name of the group/event/contact
  entityType?: string;                // e.g., "Group", "Contact", "Event", "Invite"
  meta?: Record<string, any>;         // Optional additional info (e.g., number of contacts imported)
  timestamp?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}


export interface ISMSlink extends Document {
  _id: Types.ObjectId;
  token: string;
  eventId: Types.ObjectId;
  groupId: Types.ObjectId;
  guestPhoneNumber: string;
  createdAt?: Date;
  updatedAt?: Date;
}


export interface IGIGAuthCache extends Document {
  serviceName: string;
  authToken: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}


export interface IFeeRecord extends Document {
  orderId: Types.ObjectId;
  currency: string;
  platformFee: number;
  deliveryFee: number;
  transactionFee: number;
  totalAmount: number; // full payment amount
  actualAmount: number; // after deducting delivery + transaction fee
  date: Date;
};


export interface IDeliveryFee {
  pickupState: string;
  pickupCity: string;
  destinationState: string;
  destinationCity: string;
  baseFee: number;
  multiplier: number;
}


export interface IExchangeRate extends Document {
  from: string;
  to: string;
  rate: number;
  source?: string;
  lastFetchedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
