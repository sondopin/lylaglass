import { ClientSession } from "mongoose";
import { CouponModel } from "@/models/Coupon.model";

export const couponRepository = {
  findByCode: (code: string, session?: ClientSession) =>
    CouponModel.findOne({ code: code.toUpperCase() }).session(session ?? null).lean(),
  findAll: () => CouponModel.find().sort({ createdAt: -1 }).lean(),
  findById: (id: string) => CouponModel.findById(id).lean(),
  create: (data: Record<string, unknown>) => CouponModel.create(data),
  updateById: (id: string, data: Record<string, unknown>) =>
    CouponModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean(),
  deleteById: (id: string) => CouponModel.findByIdAndDelete(id).lean(),
  /**
   * Atomically claims one redemption of a coupon, re-checking every limit that
   * `evaluateCoupon` checked earlier.
   *
   * Validating and then incrementing as two steps is a time-of-check /
   * time-of-use race: several concurrent checkouts can all read
   * `usageCount = usageLimit - 1`, all pass validation, and all increment —
   * overselling a limited campaign. Folding the conditions into the update
   * filter makes the database the arbiter, so exactly `usageLimit` callers ever
   * succeed.
   *
   * Returns `null` when the coupon just ran out (or was deactivated/expired
   * between validation and checkout); the caller must treat that as a rejection.
   */
  claimUsage: (id: string, now: Date, session?: ClientSession) =>
    CouponModel.findOneAndUpdate(
      {
        _id: id,
        isActive: true,
        $and: [
          { $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gte: now } }] },
          {
            $or: [
              { usageLimit: { $exists: false } },
              { usageLimit: null },
              { $expr: { $lt: ["$usageCount", "$usageLimit"] } },
            ],
          },
        ],
      },
      { $inc: { usageCount: 1 } },
      { new: true, session }
    ).lean(),

  /**
   * Gives back a use counted at checkout when the order never got paid. The
   * `usageCount > 0` guard keeps the counter from going negative.
   */
  decrementUsage: (id: string, session?: ClientSession) =>
    CouponModel.findOneAndUpdate(
      { _id: id, usageCount: { $gt: 0 } },
      { $inc: { usageCount: -1 } },
      { new: true, session }
    ).lean(),
};
