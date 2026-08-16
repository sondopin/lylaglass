import { getPaymentProvider, VerifiedWebhookEvent } from "@/payments";
import { paymentRepository } from "@/repositories/payment.repository";
import { orderRepository } from "@/repositories/order.repository";
import { productRepository } from "@/repositories/product.repository";
import { ApiError } from "@/utils/ApiError";
import { logger } from "@/config/logger";

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "refunded"]);

export async function handlePaymentWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
  const provider = getPaymentProvider();
  const event: VerifiedWebhookEvent = await provider.verifyWebhook(rawBody, headers);

  const payment = await paymentRepository.findByIntentId(event.intentId);
  if (!payment) {
    logger.warn({ intentId: event.intentId }, "Webhook received for unknown payment intent");
    throw ApiError.notFound("Không tìm thấy giao dịch thanh toán tương ứng");
  }

  // Idempotency: once a payment has reached a terminal state, replayed
  // webhooks (provider retries, duplicate deliveries) are safely ignored.
  if (TERMINAL_STATUSES.has(payment.status)) {
    logger.info({ intentId: event.intentId, status: payment.status }, "Ignoring webhook for already-finalized payment");
    return { alreadyProcessed: true };
  }

  await paymentRepository.updateById(String(payment._id), {
    status: event.status,
    method: event.method ?? payment.method,
    last4: event.last4 ?? payment.last4,
    failureReason: event.failureReason ?? "",
    rawEvent: event.raw,
  });

  const order = await orderRepository.findById(String(payment.orderId));
  if (!order) {
    logger.error({ orderId: payment.orderId }, "Payment webhook resolved but order no longer exists");
    return { alreadyProcessed: false };
  }

  if (event.status === "succeeded") {
    await orderRepository.updateById(String(order._id), {
      paymentStatus: "paid",
      orderStatus: order.orderStatus === "pending" ? "confirmed" : order.orderStatus,
    });
  } else if (event.status === "failed") {
    await orderRepository.updateById(String(order._id), {
      paymentStatus: "failed",
      orderStatus: "cancelled",
    });
    if (!order.inventoryReleased) {
      await Promise.all(
        order.items.map((item) => productRepository.restockVariant(item.productId, item.sku, item.quantity))
      );
      await orderRepository.updateById(String(order._id), { inventoryReleased: true });
    }
  } else if (event.status === "refunded") {
    await orderRepository.updateById(String(order._id), { paymentStatus: "refunded" });
  }

  return { alreadyProcessed: false };
}
