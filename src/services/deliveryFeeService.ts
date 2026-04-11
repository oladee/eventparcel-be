import DeliveryFee from "../models/deliveryFeeModel";
import { IDeliveryFee } from "../interfaces/modelInterface";
import { Types } from "mongoose";

export class DeliveryFeeService {
    async create(data: Partial<IDeliveryFee>) {
        return await DeliveryFee.create(data);
    }

    async getAll() {
        return await DeliveryFee.find({ status: "active" })
            .populate("pickupState", "name")
            .populate("pickupCity", "name")
            .populate("destinationState", "name")
            .populate("destinationCity", "name");
    }

    async getById(id: string) {
        return await DeliveryFee.findById(id)
            .populate("pickupState", "name")
            .populate("pickupCity", "name")
            .populate("destinationState", "name")
            .populate("destinationCity", "name");
    }

    async findByCombination(
        pickupState: string,
        pickupCity: string,
        destinationState: string,
        destinationCity: string
    ) {
        return await DeliveryFee.findOne({
            pickupState: new Types.ObjectId(pickupState),
            pickupCity: new Types.ObjectId(pickupCity),
            destinationState: new Types.ObjectId(destinationState),
            destinationCity: new Types.ObjectId(destinationCity),
        });
    }

    async update(id: string, data: Partial<IDeliveryFee>) {
        return await DeliveryFee.findByIdAndUpdate(id, data, { new: true })
            .populate("pickupState", "name")
            .populate("pickupCity", "name")
            .populate("destinationState", "name")
            .populate("destinationCity", "name");
    }

    async softDelete(id: string) {
        return await DeliveryFee.findByIdAndUpdate(id, { status: "inactive" }, { new: true });
    }

    async bulkInsertActive(rows: Partial<IDeliveryFee>[]) {
        return await DeliveryFee.insertMany(rows);
    }

    async bulkUpsert(rows: Partial<IDeliveryFee>[]) {
        const ops = rows.map(row => ({
            updateOne: {
                filter: {
                    pickupState: row.pickupState,
                    pickupCity: row.pickupCity,
                    destinationState: row.destinationState,
                    destinationCity: row.destinationCity,
                },
                update: { $set: { ...row, status: "active" as const } },
                upsert: true,
            },
        }));
        return await DeliveryFee.bulkWrite(ops);
    }
}

export default new DeliveryFeeService();
