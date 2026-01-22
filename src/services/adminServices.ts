import { IUser } from "../interfaces/modelInterface";
import { AdminModel } from "../models/adminModel";

export class AdminService {
  // Get all Admins, sorted by creation date (newest first).
  public static getAdmins(filter: any = {}): Promise<IUser[]> {
    return AdminModel.find(filter)
    .sort({ createdAt: -1 });
  }

  
  // Find a Admin by email.
  public static getAdminByEmail(email: string): Promise<IUser | null> {
    return AdminModel.findOne({ email });
  }


  // Find a Admin by a given field, e.g., { name: "Eben" }.
  public static getAdminByField(query: Partial<IUser>): Promise<any> {
    return AdminModel.findOne(query as any);
  }


  // Find a Admin by ID.
  public static getAdminById(id: string): Promise<IUser | null> {
    return AdminModel.findById(id);
  }


  // Create a new Admin.
  public static async createAdmin(values: Record<string, any>): Promise<IUser> {
    const admin = new AdminModel(values);
    await admin.save();
    return admin;
  }


  // Delete a Admin by their ID.
  public static deleteAdminById(id: string): Promise<IUser | null> {
    return AdminModel.findOneAndDelete({ _id: id });
  }


  // Update a Admin by their ID.
  public static updateAdminById(
    id: string,
    values: Record<string, any>,
    newOption: boolean = true
  ): Promise<IUser | null> {
    return AdminModel.findOneAndUpdate({ _id: id }, values, { new: newOption });
  }
}
