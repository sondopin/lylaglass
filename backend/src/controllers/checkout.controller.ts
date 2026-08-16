import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendCreated } from "@/utils/apiResponse";
import { processCheckout } from "@/services/checkout.service";

export const createCheckout = asyncHandler(async (req: Request, res: Response) => {
  const result = await processCheckout(req.body);
  sendCreated(res, result);
});
