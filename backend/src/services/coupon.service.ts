import { ApiError } from "@/utils/ApiError";
import { couponRepository } from "@/repositories/coupon.repository";
import { Coupon } from "@/models/Coupon.model";

export interface CouponEvaluation {
  code: string;
  type: Coupon["type"];
  discountTotal: number;
  freeShipping: boolean;
}

export async function evaluateCoupon(code: string, subtotal: number): Promise<CouponEvaluation> {
  const coupon = await couponRepository.findByCode(code);
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

  return { code: coupon.code, type: coupon.type, discountTotal, freeShipping };
}
