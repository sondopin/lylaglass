import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import { orderRepository, OrderListFilters } from "@/repositories/order.repository";
import { getOrderForCustomer, cancelOrder } from "@/services/order.service";
import { getPaymentStatusForCustomer } from "@/services/payment.service";
import { paymentRepository } from "@/repositories/payment.repository";
import { PaymentStatusQuery } from "@/validators/payment.validators";
import { ApiError } from "@/utils/ApiError";

export const lookupOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await getOrderForCustomer(req.params.orderNumber, req.query.email as string);
  sendSuccess(res, order);
});

/**
 * Live payment state for a guest customer, polled by the storefront's payment
 * page. Explicitly uncacheable: a stale "pending" here would leave a customer
 * who has already paid staring at a QR code.
 */
export const getOrderPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  // Already parsed and coerced by validate({ query: paymentStatusQuerySchema }).
  const query = req.query as unknown as PaymentStatusQuery;
  const result = await getPaymentStatusForCustomer(req.params.orderNumber, query.email, query.includeQr);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  sendSuccess(res, result);
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
  // Admins reconcile transfers from this screen, so the payment record —
  // payment code, bank transaction id, reference code, amounts, timestamps —
  // travels with the order.
  const payment = await paymentRepository.findByOrderId(req.params.id);
  sendSuccess(res, { ...order, payment });
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
