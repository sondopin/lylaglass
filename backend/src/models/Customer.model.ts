import { Schema, model, Types, InferSchemaType } from "mongoose";

// Guest-first: created lazily from checkout info (matched by email) so repeat
// guests can be recognized in the admin without ever requiring an account/login.
const customerSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, default: "" },
    ordersCount: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type Customer = InferSchemaType<typeof customerSchema> & { _id: Types.ObjectId };
export const CustomerModel = model("Customer", customerSchema);
