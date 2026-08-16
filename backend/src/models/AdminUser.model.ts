import { Schema, model, Types, InferSchemaType } from "mongoose";

const adminUserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["owner", "staff"], default: "staff" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export type AdminUser = InferSchemaType<typeof adminUserSchema> & { _id: Types.ObjectId };
export const AdminUserModel = model("AdminUser", adminUserSchema);
