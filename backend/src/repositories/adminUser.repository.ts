import { AdminUserModel } from "@/models/AdminUser.model";

export const adminUserRepository = {
  findByEmail: (email: string) => AdminUserModel.findOne({ email: email.toLowerCase() }),
  findById: (id: string) => AdminUserModel.findById(id).lean(),
  create: (data: Record<string, unknown>) => AdminUserModel.create(data),
  countAll: () => AdminUserModel.countDocuments(),
  touchLastLogin: (id: string) => AdminUserModel.findByIdAndUpdate(id, { lastLoginAt: new Date() }),
};
