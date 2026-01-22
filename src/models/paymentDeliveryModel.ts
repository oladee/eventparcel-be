import mongoose, { Schema, model, Document } from "mongoose";
import { INairaPayout, IDollarPayout, IPaymentAndDelivery } from "../interfaces/modelInterface";

const NairaAccount = new Schema<INairaPayout>(
  {
    accountNumber: {
      type: String,
      required: false,
    },
    bankName: {
      type: String,
      required: false,
    },
    accountName: {
      type: String,
      required: false,
      lowercase: true,
    },
    bankCode: {
      type: String,
      required: false,
    },
    recipientCode: {
      type: String,
      required: false,
    }
  }
);


const DollarAccount = new Schema<IDollarPayout>(
  {
    usAccountNumber: {
      type: String,
      required: false,
    },
    routingNumber: {
      type: String,
      required: false,
    },
    usBankName: {
      type: String,
      required: false,
    },
    usAccountName: {
      type: String,
      required: false,
      lowercase: true,
    },
  }
);



const PaymentAndDeliverySchema = new Schema<IPaymentAndDelivery>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    nairaAccount: {
      type: NairaAccount,
    },
    dollarAccount: {
      type: DollarAccount,
    },
    paymentDate: {
      type: String,
      required: true,
    },
    paymentTime: {
      type: String,
      required: true,
    },
    paymentTimeZone: {
      type: String,
      required: true,
      uppercase: true,
    },
    contactName: {
      type: String,
      lowercase: true,
    },
    contactPhoneNumber: {
      type: String,
    },
    pickupLocation: {
      type: String,
      lowercase: true,
    },
    pickupLatitude: {
      type: String,
    },
    pickupLongitude: {
      type: String,
    },
    state: {
      type: String
    },
    city: {
      type: String
    },
    deliveryDate: {
      type: String,
    },
    deliveryTime: {
      type: String,
    },
    deliveryTimeZone: {
      type: String,
      uppercase: true,
    },
    isDraft: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const PaymentAndDeliveryModel = model<IPaymentAndDelivery>(
  "PaymentAndDelivery",
  PaymentAndDeliverySchema
);
