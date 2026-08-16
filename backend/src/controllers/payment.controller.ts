import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import { handlePaymentWebhook } from "@/services/payment.service";

export const receivePaymentWebhook = asyncHandler(async (req: Request, res: Response) => {
  const result = await handlePaymentWebhook(req.body as Buffer, req.headers);
  sendSuccess(res, result);
});
