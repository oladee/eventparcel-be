import mongoose, { Types } from "mongoose";
import { CoHostInvite } from "../models/coHostInviteModel";


export class CoHostInviteService {
    public static async getCoHostInvite(token: string) {
        const invite = await CoHostInvite.findOne({ token })
            .populate({
                path: "coHost",
                model: "User",
                select: "firstName lastName email phoneNumber imageUrl role",
            })
            .populate({
                path: "host",
                model: "User",
                select: "firstName lastName email phoneNumber imageUrl role",
            })
            .populate({
                path: "event",
                model: "Event",
                select: "eventName date time eventLocation",
            })

        return invite;
    }


    public static async deleteCoHostInvite(token: string) {
        return await CoHostInvite.deleteOne({ token });
    }
}