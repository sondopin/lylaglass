import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import { orderRepository, OrderListFilters } from "@/repositories/order.repository";
import { getOrderForCustomer, cancelOrder } from "@/services/order.service";
import { ApiError } from "@/utils/ApiError";

export const lookupOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await getOrderForCustomer(req.params.orderNumber, req.query.email as string);
  sendSuccess(res, order);
});

export const listAdminOrders = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as OrderListFilters;
  const { items, total } = await orderRepository.list(filters);
  sendSuccess(res, items, 200, {
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
  });
});

export const getAdminOrderById = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderRepository.findById(req.params.id);
  if (!order) throw ApiError.notFound("Không tìm thấy đơn hàng");
  sendSuccess(res, order);
});

export const updateAdminOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderRepository.updateById(req.params.id, req.body);
  if (!order) throw ApiError.notFound("Không tìm thấy đơn hàng");
  sendSuccess(res, order);
});

export const cancelAdminOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await cancelOrder(req.params.id);
  sendSuccess(res, order);
});
