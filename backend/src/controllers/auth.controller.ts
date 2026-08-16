import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import { loginAdmin } from "@/services/auth.service";
import { adminUserRepository } from "@/repositories/adminUser.repository";
import { ApiError } from "@/utils/ApiError";

export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await loginAdmin(email, password);
  sendSuccess(res, result);
});

export const getCurrentAdmin = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized();
  const admin = await adminUserRepository.findById(req.admin.sub);
  if (!admin) throw ApiError.unauthorized();
  sendSuccess(res, { id: admin._id, name: admin.name, email: admin.email, role: admin.role });
});
