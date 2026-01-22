import { PaymentAndDeliveryModel } from '../models/paymentDeliveryModel';
import { INairaPayout, IDollarPayout, IPaymentAndDelivery } from '../interfaces/modelInterface';
import mongoose from 'mongoose';

class PaymentAndDeliveryService {
  /**
   * Create a new payment and delivery record
   */
  static async createPaymentAndDelivery(data: Partial<IPaymentAndDelivery | any>): Promise<IPaymentAndDelivery | null> {
    return await PaymentAndDeliveryModel.create(data);
    }

  /**
   * Get a single payment and delivery record by ID
   */
  static async getOneById(id: string): Promise<IPaymentAndDelivery | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid ID format');
    }
    return await PaymentAndDeliveryModel.findById(id)
    .populate('user', 'firstName lastName email phoneNumber imageUrl role') 
    .populate('event')
  }


    /**
   * Get a single payment and delivery record by field
   */
    static async getOneByField(query: Partial<IPaymentAndDelivery>): Promise<IPaymentAndDelivery | null> {
      return await PaymentAndDeliveryModel.findOne(query as any)
      .populate('user', 'firstName lastName email phoneNumber imageUrl role')
      .populate('event')
    }


  /**
   * Get all payment and delivery records for a specific user
   */
  static async getAllByUser(userId: string): Promise<IPaymentAndDelivery[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID format');
    }
    return await PaymentAndDeliveryModel.find({ user: userId })
    .populate('user', 'firstName lastName email phoneNumber imageUrl role')
    .populate('event')
    .sort({ createdAt: -1 });
  }

  /**
   * Get all payment and delivery records
   */
  static async getAll(): Promise<IPaymentAndDelivery[]> {
    return await PaymentAndDeliveryModel.find()
    .populate('user', 'firstName lastName email phoneNumber imageUrl role')
    .populate('event')
  }

  /**
   * Update a payment and delivery record by ID
   */
  static async updateById(id: string, data: Partial<IPaymentAndDelivery>): Promise<IPaymentAndDelivery | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid ID format');
    }
    return await PaymentAndDeliveryModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  /**
   * Delete a payment and delivery record by ID
   */
  static async deleteById(id: string): Promise<IPaymentAndDelivery | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid ID format');
    }
    return await PaymentAndDeliveryModel.findByIdAndDelete(id);
  }
}

export default PaymentAndDeliveryService;
