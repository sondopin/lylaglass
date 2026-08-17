import { CouponModel } from "@/models/Coupon.model";

export const couponRepository = {
  findByCode: (code: string) => CouponModel.findOne({ code: code.toUpperCase() }).lean(),
  findAll: () => CouponModel.find().sort({ createdAt: -1 }).lean(),
  findById: (id: string) => CouponModel.findById(id).lean(),
  create: (data: Record<string, unknown>) => CouponModel.create(data),
  updateById: (id: string, data: Record<string, unknown>) =>
    CouponModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean(),
  deleteById: (id: string) => CouponModel.findByIdAndDelete(id).lean(),
  incrementUsage: (id: string) => CouponModel.findByIdAndUpdate(id, { $inc: { usageCount: 1 } }),
  /**
   * Gives back a use counted at checkout when the order never got paid. The
   * `usageCount > 0` guard keeps the counter from going negative.
   */
  decrementUsage: (id: string) =>
    CouponModel.findOneAndUpdate({ _id: id, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } }, { new: true }).lean(),
};
