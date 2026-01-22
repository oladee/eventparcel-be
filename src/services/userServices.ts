import { User, Host, CoHost, Admin, SuperAdmin, } from "../models/userModel"; 
import { IBaseUser, IHost, ICoHost, IAdmin, ISuperAdmin, IUser } from "../interfaces/modelInterface";
import mongoose from "mongoose";

// Map roles to discriminator models
const roleModelMap: Record<string, mongoose.Model<any>> = {
  host: Host,
  cohost: CoHost,
  admin: Admin,
  superAdmin: SuperAdmin,
  // Add more roles here if needed
};

// export class UserService {
//   // Get all users, sorted by creation date (newest first).
//   public static getUsers(filter: any = {}): Promise<IUser[]> {
//     return User.find(filter)
//     .sort({ createdAt: -1 })
//     .populate({
//       path: "host",
//       model: "User",
//       select: "firstName lastName email phoneNumber imageUrl role",
//     });
//   }

//   // Find a user by email.
//   public static getUserByEmail(email: string): Promise<IUser | null> {
//     return User.findOne({ email });
//   }

//   // Find a user by a given field, e.g., { name: "Eben" }.
//   public static getUserByField(query: Partial<IUser>): Promise<any> {
//     return User.findOne(query as any)
//     .populate({
//       path: "host",
//       model: "User",
//     });
//   }

//   // Find a user by ID.
//   public static getUserById(id: string): Promise<IUser | null> {
//     return User.findById(id)
//     .populate({
//       path: "host",
//       model: "User",
//     });
//   }

//   // Create a new user.
//   public static async createUser(values: Record<string, any>): Promise<IUser> {
//     const user = new User(values);
//     await user.save();
//     return user;
//   }

//   // Delete a user by their ID.
//   public static deleteUserById(id: string): Promise<IUser | null> {
//     return User.findOneAndDelete({ _id: id });
//   }

//   // Update a user by their ID.
//   public static updateUserById(
//     id: string,
//     values: Record<string, any>,
//     newOption: boolean = true
//   ): Promise<IUser | null> {
//     return User.findOneAndUpdate({ _id: id }, values, { new: newOption });
//   }
// }



export class UserService {
  // Get all users (or filtered by role, etc.)
  public static getUsers(filter: any = {}, skip = 0, limit?: number): Promise<IBaseUser[]> {
    const query = User.find(filter)
      .sort({ createdAt: -1 })
      .populate({
        path: "host",
        model: "User",
        select: "firstName lastName email phoneNumber imageUrl role",
      })
      .skip(skip);
  
    if (typeof limit === "number") {
      query.limit(limit);
    }
  
    return query.exec();
  }

  // Get all users by IDs 
  public static async getUsersByIds(userIds: string[]) {
  if (!userIds?.length) return [];
  return User.find({ _id: { $in: userIds } })
    .select("firstName lastName email phoneNumber imageUrl role")
    .lean()
    .exec();
}
  

  // Find a user by email
  public static getUserByEmail(email: string): Promise<IBaseUser | null> {
    return User.findOne({ email });
  }

  // Find a user by any field
  public static getUserByField(query: any = {}): Promise<IBaseUser | null> {
    return User.findOne(query as any)
      .populate({
        path: "host",
        model: "User",
      });
  }

  // Find a user by ID
  public static getUserById(id: string): Promise<IBaseUser | null> {
    return User.findById(id)
      .populate({
        path: "host",
        model: "User",
      });
  }

  // Create a new user (choose discriminator based on role)
  public static async createUser(values: Record<string, any>): Promise<IBaseUser> {
    let user;
    if (values.role === "host") {
      user = new Host(values);
    } else if (values.role === "cohost") {
      user = new CoHost(values);
    } else if (values.role === "admin") {
      user = new Admin(values);
    } else if (values.role === "superAdmin") {
      user = new SuperAdmin(values);
    } else {
      throw new Error("Invalid role specified.");
    }
    await user.save();
    return user;
  }

  // Delete a user
  public static deleteUserById(id: string): Promise<IBaseUser | null> {
    return User.findOneAndDelete({ _id: id });
  }

  // Update a user
  public static updateUserById(
    id: string | any,
    values: Record<string, any>,
    newOption: boolean = true
  ): Promise<IBaseUser | null> {
    return User.findOneAndUpdate({ _id: id }, values, { new: newOption });
  }


// Function to Promote a User from e.g From CoHost to Host
public static async promoteUserRole(userId: string, targetRole: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Ensure the target role has a corresponding model
      const TargetModel = roleModelMap[targetRole];
      if (!TargetModel) {
        throw new Error(`Unsupported role: ${targetRole}`);
      }

      // Fetch old user
      const oldUser = await User.findById(userId).lean().session(session);
      if (!oldUser) {
        throw new Error("User not found");
      }

      const {
        _id,
        __v,
        role,
        createdAt,
        updatedAt,
        ...rest
      } = oldUser;

      // Delete old user
      await User.findByIdAndDelete(userId).session(session);

      // Recreate new user with the new role (reusing the same _id)
      const newUser = await TargetModel.create(
        [{
          _id: new mongoose.Types.ObjectId(userId),
          ...rest,
          role: targetRole,
        }],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return newUser[0];
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }


    // Count the number of user based on a filter.
    public static async countUsers(filter: any = {}) {
      return User.countDocuments(filter);
    }
}
