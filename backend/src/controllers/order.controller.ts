import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import { orderRepository, OrderListFilters } from "@/repositories/order.repository";
import { getOrderForCustomer, cancelOrder } from "@/services/order.service";
import { getPaymentStatusForCustomer } from "@/services/payment.service";
import { paymentRepository } from "@/repositories/payment.repository";
import { PaymentStatusQuery } from "@/validators/payment.validators";
import { ApiError } from "@/utils/ApiError";
import { buildSpxExportBuffer } from "@/services/spxExport.service";
import { z } from "zod";
import { exportSpxOrdersSchema } from "@/validators/order.validators";

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

/** SPX's own mass-order-creation import caps uploads at 5MB. */
const SPX_MAX_FILE_BYTES = 5 * 1024 * 1024;

export const exportSpxOrders = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof exportSpxOrdersSchema>;

  const orders = body.orderIds
    ? await orderRepository.findManyByIds(body.orderIds)
    : await orderRepository.findAllByFilters(body.filters ?? {});

  if (orders.length === 0) throw ApiError.badRequest("Không có đơn hàng nào phù hợp để xuất");

  const unpaid = orders.filter((o) => o.paymentStatus !== "paid");
  if (unpaid.length > 0) {
    throw ApiError.badRequest(
      `${unpaid.length} đơn chưa thanh toán, không thể xuất sang SPX. Vui lòng bỏ chọn các đơn này.`,
      { orderNumbers: unpaid.map((o) => o.orderNumber) }
    );
  }

  const { buffer, rowCount } = await buildSpxExportBuffer(orders, body.options);

  if (buffer.byteLength > SPX_MAX_FILE_BYTES) {
    const bytesPerOrder = buffer.byteLength / orders.length;
    // Leave a 5% margin below SPX's own cap so the estimate stays valid.
    const suggestedMaxOrders = Math.max(1, Math.floor((SPX_MAX_FILE_BYTES * 0.95) / bytesPerOrder));
    throw ApiError.badRequest(
      `File Excel (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB) vượt quá giới hạn 5MB của SPX. ` +
        `Đã chọn ${orders.length} đơn — vui lòng chia nhỏ, mỗi lần xuất khoảng ${suggestedMaxOrders} đơn trở xuống.`,
      { orderCount: orders.length, suggestedMaxOrders }
    );
  }

  const filename = `spx-tao-don-${new Date().toISOString().slice(0, 10)}-${rowCount}dong.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});
