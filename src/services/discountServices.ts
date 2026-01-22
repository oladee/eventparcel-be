import { DiscountModel } from "../models/discountModel";
import { IDiscount } from "../interfaces/modelInterface";
import mongoose from "mongoose";

class DiscountService {
  /**
   * Create a new discount
   */
  static async createDiscount(data: Partial<IDiscount>): Promise<IDiscount | null> {
    return await DiscountModel.create(data);
  }

  /**
   * Get a single discount by ID
   */
  static async getOneById(id: string): Promise<IDiscount | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid ID format");
    }
    return await DiscountModel.findById(id).populate("event");
  }

  /**
   * Get a discount by field
   */
  static async getOneByField(query: Partial<IDiscount>): Promise<IDiscount | null> {
    return await DiscountModel.findOne(query as any).populate("event");
  }

  /**
   * Get all discounts
   */
  static async getAll(filter: any = {}, skip = 0, limit = 10): Promise<IDiscount[]> {
    return await DiscountModel.find(filter).sort({ createdAt: -1 })
    .populate("hostId", "_id firstName lastName email role imageUrl")
    .populate("event");
    // .skip(skip)
    // .limit(limit);
  }

  /**
   * Update a discount by ID
   */
  static async updateById(id: string, data: Partial<IDiscount>): Promise<IDiscount | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid ID format");
    }
    return await DiscountModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  /**
   * Delete a discount by ID
   */
  static async deleteById(id: string): Promise<IDiscount | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid ID format");
    }
    return await DiscountModel.findByIdAndDelete(id);
  }

/**  
 * Count the number of discounts based on a filter
 */
   public static async countDiscounts(filter: any) {
      return DiscountModel.countDocuments(filter);
   }
}

export default DiscountService;
