import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import { getDashboardStats } from "@/services/dashboard.service";

export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await getDashboardStats();
  sendSuccess(res, stats);
});
