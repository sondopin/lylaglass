import { Schema, model, Types, InferSchemaType } from "mongoose";

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    type: { type: String, enum: ["percentage", "fixed", "free_shipping"], required: true },
    value: { type: Number, required: true, min: 0 }, // ignored for free_shipping
    minimumSubtotal: { type: Number, default: 0 },
    maxDiscountAmount: { type: Number },
    usageLimit: { type: Number }, // total redemptions allowed, undefined = unlimited
    usageCount: { type: Number, default: 0 },
    startsAt: { type: Date },
    endsAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type Coupon = InferSchemaType<typeof couponSchema> & { _id: Types.ObjectId };
export const CouponModel = model("Coupon", couponSchema);
