import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendCreated, sendSuccess } from "@/utils/apiResponse";
import { listProductReviews, createProductReview } from "@/services/review.service";

export const getProductReviews = asyncHandler(async (req: Request, res: Response) => {
  const result = await listProductReviews(req.params.productId);
  sendSuccess(res, result);
});

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const summary = await createProductReview(req.params.productId, req.body);
  sendCreated(res, summary);
});
