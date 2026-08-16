import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import { settingsRepository } from "@/repositories/settings.repository";

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingsRepository.get();
  sendSuccess(res, settings);
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsRepository.update(req.body);
  sendSuccess(res, settings);
});
