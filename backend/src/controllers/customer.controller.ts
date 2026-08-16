import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import { customerRepository } from "@/repositories/customer.repository";
import { ApiError } from "@/utils/ApiError";

export const listAdminCustomers = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const [items, total] = await customerRepository.list(page, limit, req.query.q as string | undefined);
  sendSuccess(res, items, 200, { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

export const getAdminCustomerById = asyncHandler(async (req: Request, res: Response) => {
  const customer = await customerRepository.findById(req.params.id);
  if (!customer) throw ApiError.notFound("Không tìm thấy khách hàng");
  sendSuccess(res, customer);
});
