import { JwtPayload } from "jsonwebtoken";
import { IEvent } from "./modelInterface";

// The result type for token verification
export interface VerifyTokenResult {
  valid: boolean;
  decoded?: string | JwtPayload;
  error?: any;
}

export interface IApiResponse {
  success: boolean;
  message: string;
  data?: any;
  [key: string]: any; // This allows dynamic fields
}

export interface IPaystackEvent {
  event: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    email: string;
    transfer_code?: string;
    fees?: number;
  };
}

// export interface IPaypalEvent {
//   event_type: string;
//   resource: {
//     id: string;
//     amount: {
//       value: string;
//       currency_code: string;
//     };
//     transaction_fee?: {
//       value: string;
//       currency_code: string;
//     };
//     payer: {
//       email_address: string;
//     };
//   };
// }

export interface IPaypalEvent {
  event_type: string;
  resource: {
    id: string;
    amount: {
      value: string;
      currency_code: string;
    };
    seller_receivable_breakdown?: {
      gross_amount: {
        value: string;
        currency_code: string;
      };
      paypal_fee: {
        value: string;
        currency_code: string;
      };
      net_amount: {
        value: string;
        currency_code: string;
      };
    };
    payer?: {
      email_address: string;
    };
  };
}


export interface IHwEvent {
  type: string;
  object: {
    token: string;
    clientPaymentId: string;
    amount: string;
    currency: string;
    status: string;
    destinationToken: string;
    email?: string;
    fees?: string;
  };
}

export interface INormalizedPaymentEvent {
  reference: string;
  amount: number;
  currency: string;
  email: string;
  provider: "paystack" | "paypal" | "hyperwallet";
  transfer_code?: string;
  status?: string;
  fees?: number;
}

export interface ISalesSummary {
  totalAmount: number;
  growthRate: number;
  growthRateDaily: number;
  monthlySales: { month: string; sales: number }[];
  dailySales: { day: string; sales: number }[];
}

export interface IWeekSummary {
  week: string;
  orders: number;
}
export interface IDeliveredSummary {
  week: string;
  delivered: number;
}
export interface IPendingSummary {
  week: string;
  pending: number;
}

export interface IShippedSummary {
  week: string;
  shipped: number;
}

export interface IOrderSummary {
  ordersSummary: {
    totalOrders: {
      overall: number;
      byWeek: IWeekSummary[];
      growthRate: number;
    };
    totalDelivered: {
      overall: number;
      byWeek: IDeliveredSummary[];
      growthRate: number;
    };
    pendingOrders: {
      overall: number;
      byWeek: IPendingSummary[];
      growthRate: number;
    };
    shippedOrders: {
      overall: number;
      byWeek: IShippedSummary[];
      growthRate: number;
    };
    packageSold: number;
    overallSales: number;
    contacts?: number;
    stocks?: number;
  };
  invitesSummary: {
    totalInvites: number;
    totalViewed: number;
    viewedRate: number;
  };
  recentOrders: {
    id: string;
    date: string;
    status: string;
    product: string;
    price: number;
    quantity: number;
    image: string;
  }[];
}

export interface IDeliverySummary {
  totalDelivered: number;
  totalShipped: number;
  totalPending?: number;
  totalOrders?: number;
  pctDeliveredVsLastWeek: number; // e.g. +3.9
  deliveredThisWeek?: number;
  shippedThisWeek: number;
  pendingThisWeek?: number;
  pctPendingVsLastWeek?: number;
  pctTotalOrdersVsLastWeek?: number;
}

export interface ValidationResult {
  success: boolean;
  phoneNumber?: string;
  countryCode?: number;
  region?: string;
  formatted?: string;
  message?: string;
}

// export interface Location {
//   Latitude: string;  // This is a string based on request body
//   Longitude: string; // This is a string based on request body
//   FormattedAddress: string; // Optional based on API requirement
//   Name: string; // Optional field for location name (if required)
//   LGA: string; // Optional for Local Government Area
// }

// export interface PreShipmentItem {
//   PreShipmentItemMobileId: number;
//   Description: string;
//   Weight: number;
//   Weight2: number;
//   ItemType: string;
//   ShipmentType: number;
//   ItemName: string;
//   EstimatedPrice: number;
//   Value: string;
//   ImageUrl: string;
//   Quantity: number;
//   SerialNumber: number;
//   IsVolumetric: boolean;
//   Length: number | null;
//   Width: number | null;
//   Height: number | null;
//   PreShipmentMobileId: number;
//   CalculatedPrice: number | null;
//   SpecialPackageId: number | null;
//   IsCancelled: boolean;
//   PictureName: string;
//   PictureDate: string | null;
//   WeightRange: string; // weight range in string format (e.g., "0")
// }

// export interface GIGShippingRequest {
//   PreShipmentMobileId: number;  // Based on the provided body; always 0
//   SenderName: string;           // Sender's full name
//   SenderPhoneNumber: string;    // Sender's phone number
//   SenderStationId: number;     // Station ID (e.g., `1` based on your example)
//   InputtedSenderAddress: string; // Sender's inputted address
//   SenderLocality: string;      // Sender's locality (hardcoded "Ifako Ijaye")
//   ReceiverStationId: number;   // Station ID (e.g., `1`)
//   SenderAddress: string;       // Sender's full address
//   ReceiverName: string;        // Receiver's full name
//   ReceiverPhoneNumber: string; // Receiver's phone number
//   ReceiverAddress: string;     // Receiver's full address
//   InputtedReceiverAddress: string; // Inputted address for receiver
//   SenderLocation: Location;    // Sender's location coordinates and details
//   ReceiverLocation: Location;  // Receiver's location coordinates and details
//   PreShipmentItems: PreShipmentItem[]; // Array of shipment items
//   VehicleType: string;         // Type of vehicle, e.g., "BIKE"
//   IsBatchPickUp: boolean;      // Whether batch pickup is required
//   WaybillImage: string;        // Image URL for the waybill
//   WaybillImageFormat: string;  // Format of the waybill image
//   DestinationServiceCenterId: number; // Destination service center ID (if applicable)
//   DestinationServiceCentreId: number; // Alternative destination service center ID
//   IsCashOnDelivery: boolean;   // Whether COD is enabled
//   CashOnDeliveryAmount: number; // Cash on delivery amount
// }

export interface Location {
  Latitude: string;
  Longitude: string;
}

export interface PreShipmentItem {
  SpecialPackageId: string; // "0"
  Quantity: string; // string, e.g., "1"
  Weight: string; // string, e.g., "1"
  ItemType: string; // e.g., "Normal"
  WeightRange: string; // string, e.g., "0"
  ItemName: string; // e.g., "Shoe Lace"
  Value: string; // e.g., "1000"
  ShipmentType: string; // e.g., "Regular"
}

export interface GIGShippingRequest {
  ReceiverAddress: string;
  CustomerCode: string;
  SenderLocality: string;
  SenderAddress: string;
  ReceiverPhoneNumber: string;
  VehicleType: string;
  SenderPhoneNumber: string;
  SenderName: string;
  ReceiverName: string;
  UserId?: string;
  ReceiverStationId: string;
  SenderStationId: string;
  ReceiverLocation: Location;
  SenderLocation: Location;
  PreShipmentItems: PreShipmentItem[];
}

export type CurrencySummary = {
  overallSales: number;
  netSales: number;
  netSalesChange?: number;
  deliveryFee?: number;
  deliveryFeeChange?: number;
  serviceFee?: number;
  serviceFeeChange?: number;
  netPayout?: number;
};

export type PaymentSummary = {
  summaryByCurrency: Record<string, CurrencySummary>; // e.g. { NGN: { overallSales, netSales }, USD: {...} }
};

export interface IOrderStatus {
  _id: string;
  count: number;
}

export interface AdminDashboardData {
  totalOrder: {
    value: number;
    growth: number;
  };
  totalEvents: {
    value: number;
    growth: number;
  };
  totalHosts: {
    value: number;
    growth: number;
  };
  totalServiceFees: {
    value: number;
    growth: number;
  };
  orderStats: {
    completed: number;
    shipped: number;
    pending: number;
  };
  overallSales: {
    naira: any;
    dollar: any;
  };
  recentEvents: IEvent[];
}

export interface PackageSize {
  smallBox: 1;
  mediumBox: 4;
  largeBox: 10;
  extraLargeBox: 100;
}

export const packageSizeWeight: PackageSize = {
  smallBox: 1,
  mediumBox: 4,
  largeBox: 10,
  extraLargeBox: 100,
};

export interface OrderItem {
  packageId: string;
  quantity: number;
}

export interface GoogleContact {
  names?: { displayName?: string }[];
  phoneNumbers?: { canonicalForm?: string; value?: string }[];
}

export interface IPickUpDetails {
  contactName: string;
  contactPhoneNumber: string;
  pickUpStartDate: string;
  pickUpStartTime: string;
  pickUpStartTimeZone: string;
  pickUpAddress: string;
}
    

// Define the type once for reuse
export interface CurrencySummaryType {
  netSales: number;
  netSalesChange: number;
  deliveryFee: number;
  deliveryFeeChange: number;
  serviceFee: number;
  serviceFeeChange: number;
  overallSales: number;
  netPayout?: number;
};



export interface FeeSummary {
  _id: string;
  totalPlatformFees: number;
  totalDeliveryFees: number;
  totalTransactionFees: number;
  totalActualAmount: number; // This is the total amount after all fees
  count: number;
}

export interface PlatformFeeSummary {
  totalPlatformFeeNGN: number;
  totalPlatformFeeUSD: number;
  lastWeekPlatformFeeNGN: number;
  thisWeekPlatformFeeNGN: number;
  lastWeekPlatformFeeUSD: number;
  thisWeekPlatformFeeUSD: number;
}
