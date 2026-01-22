import DeliveryFee from "../models/deliveryFeeModel";
import { IDeliveryFee } from "../interfaces/modelInterface";

export class DeliveryFeeService {
    async create(data: IDeliveryFee) {
        return await DeliveryFee.create(data);
    }

    async getAll() {
        return await DeliveryFee.find();
    }

    async getById(id: string) {
        return await DeliveryFee.findById(id);
    }

    async update(id: string, data: Partial<IDeliveryFee>) {
        return await DeliveryFee.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id: string) {
        return await DeliveryFee.findByIdAndDelete(id);
    }

    async bulkImport(data: IDeliveryFee[]) {
        return await DeliveryFee.insertMany(data);
    }
}

export default new DeliveryFeeService();
