import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendCreated, sendSuccess } from "@/utils/apiResponse";
import { couponRepository } from "@/repositories/coupon.repository";
import { evaluateCoupon } from "@/services/coupon.service";
import { ApiError } from "@/utils/ApiError";

export const validateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code, subtotal } = req.body;
  const evaluation = await evaluateCoupon(code, subtotal);
  sendSuccess(res, evaluation);
});

export const listAdminCoupons = asyncHandler(async (_req: Request, res: Response) => {
  const coupons = await couponRepository.findAll();
  sendSuccess(res, coupons);
});

export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await couponRepository.create(req.body);
  sendCreated(res, coupon);
});

export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await couponRepository.updateById(req.params.id, req.body);
  if (!coupon) throw ApiError.notFound("Không tìm thấy mã giảm giá");
  sendSuccess(res, coupon);
});

export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await couponRepository.deleteById(req.params.id);
  if (!coupon) throw ApiError.notFound("Không tìm thấy mã giảm giá");
  sendSuccess(res, { deleted: true });
});
