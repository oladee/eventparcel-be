import mongoose, { Schema, model, Document } from "mongoose";
import { IOrder, IOrderItem } from "../interfaces/modelInterface";

const orderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: String,
      unique: true,
    },
    guestFirstName: { type: String, required: true, lowercase: true, },
    guestLastName: { type: String, required: true, lowercase: true, },
    guestEmail: { type: String, required: true, lowercase: true, },
    guestPhoneNumber: { type: String, required: true },
    hostId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    eventGroupId: {
      type: Schema.Types.ObjectId,
      ref: "EventGroup",
      required: true,
    },
    items: [
      {
        packageId: { type: Schema.Types.ObjectId, ref: "Package" },
        packageImgUrls: [String],
        packageImgPublicIds: [String],
        packageTitle: String,
        packageDescription: String,
        packagePriceCurrency: String,
        packagePrice: Number,
        quantity: Number,
        deliveryMethod: String,
        packageSize: String,
      },
    ],
    discountCode: { type: String, required: false },
    itemTotal: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    totalAmountCurrency: { type: String, required: true, enum: ["USD", "NGN"] },
    shippingAddress: { type: String },
    addressLatitude: { type: String },
    addressLongitude: { type: String },
    state: { type: String },
    city: { type: String },
    dispatchType: { type: String },
    deliveryType: { type: String },
    homeDeliveryFee: { type: Number },
    discount: { type: Number },
    txnFee : { type: Number },
    tax: { type: Number },
    trackingId: { type: String },
    trackingUrl: { type: String },
    paymentStatus: {
      type: String,
      enum: ["processing", "pending", "paid"],
      default: "pending",
      lowercase: true,
    },
    orderStatus: {
      type: String,
      enum: ["pending", "shipped", "delivered", "pickedUp", "attempted"],
      default: "pending",
      // lowercase: true,
    },
    shippedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    pickedUpAt: {
      type: Date,
    },
    pickUpDetails: {
      type: Object,
    },
    reprocess: { 
      type: Boolean, 
      default: false 
    },
  },
  { timestamps: true }
);

// Generate a custom orderId before saving the order
orderSchema.pre("save", async function (next) {
  if (!this.orderId) {
    try {
      // Find the most recent order
      const lastOrder = await mongoose
        .model<IOrder>("Order")
        .findOne()
        .sort({ createdAt: -1 });

      let newOrderNumber = 10001; // Default start number

      if (lastOrder && lastOrder.orderId) {
        // Extract the numeric part of orderId and increment it
        const lastOrderNumber = parseInt(lastOrder.orderId.split("_")[1], 10);
        if (!isNaN(lastOrderNumber)) {
          newOrderNumber = lastOrderNumber + 1;
        }
      }

      this.orderId = `ORD_${newOrderNumber}`;
      next();
    } catch (error: any) {
      return next(error);
    }
  } else {
    next();
  }
});

// Export the model with type safety
export const OrderModel = model<IOrder>("Order", orderSchema);
