import { ClientSession, Types } from "mongoose";
import { ApiError } from "@/utils/ApiError";
import { couponRepository } from "@/repositories/coupon.repository";
import { Coupon } from "@/models/Coupon.model";

export interface CouponEvaluation {
  couponId: Types.ObjectId;
  code: string;
  type: Coupon["type"];
  discountTotal: number;
  freeShipping: boolean;
}

/**
 * Validates a coupon against a cart subtotal and computes what it is worth.
 *
 * This is a *read-only* evaluation — it deliberately does not consume a
 * redemption, because it also backs the storefront's "apply coupon" preview.
 * Checkout follows it with `couponRepository.claimUsage`, which re-checks the
 * same limits atomically; treating the checks here as sufficient would be a
 * time-of-check/time-of-use race.
 */
export async function evaluateCoupon(
  code: string,
  subtotal: number,
  session?: ClientSession
): Promise<CouponEvaluation> {
  const coupon = await couponRepository.findByCode(code, session);
  if (!coupon || !coupon.isActive) throw ApiError.badRequest("Mã giảm giá không tồn tại hoặc đã ngừng áp dụng");

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) throw ApiError.badRequest("Mã giảm giá chưa bắt đầu áp dụng");
  if (coupon.endsAt && now > coupon.endsAt) throw ApiError.badRequest("Mã giảm giá đã hết hạn");
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit)
    throw ApiError.badRequest("Mã giảm giá đã hết lượt sử dụng");
  if (subtotal < (coupon.minimumSubtotal ?? 0))
    throw ApiError.badRequest(
      `Đơn hàng tối thiểu ${(coupon.minimumSubtotal ?? 0).toLocaleString("vi-VN")}đ để dùng mã này`
    );

  let discountTotal = 0;
  let freeShipping = false;

  if (coupon.type === "percentage") {
    discountTotal = Math.round((subtotal * coupon.value) / 100);
    if (coupon.maxDiscountAmount) discountTotal = Math.min(discountTotal, coupon.maxDiscountAmount);
  } else if (coupon.type === "fixed") {
    discountTotal = Math.min(coupon.value, subtotal);
  } else {
    freeShipping = true;
  }

  // A discount can reduce an order to zero but never below it.
  discountTotal = Math.min(discountTotal, subtotal);

  return { couponId: coupon._id, code: coupon.code, type: coupon.type, discountTotal, freeShipping };
}
