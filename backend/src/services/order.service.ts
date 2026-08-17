import { Types } from "mongoose";
import { ApiError } from "@/utils/ApiError";
import { logger } from "@/config/logger";
import { orderRepository } from "@/repositories/order.repository";
import { productRepository } from "@/repositories/product.repository";
import { couponRepository } from "@/repositories/coupon.repository";

/**
 * The minimum an order has to expose to be unwound. Kept narrow on purpose so
 * both lean records and freshly created documents can be passed in.
 */
export interface ReleasableOrder {
  _id: Types.ObjectId;
  orderNumber: string;
  couponCode?: string | null;
  items: ReadonlyArray<{ productId: Types.ObjectId; sku: string; quantity: number }>;
}

export async function getOrderForCustomer(orderNumber: string, email: string) {
  const order = await orderRepository.findByOrderNumber(orderNumber.toUpperCase());
  if (!order || order.customer?.email.toLowerCase() !== email.toLowerCase()) {
    throw ApiError.notFound("Không tìm thấy đơn hàng với thông tin đã cung cấp");
  }
  return order;
}

/**
 * Gives back everything checkout reserved for an order that will not be paid:
 * variant stock and, when a coupon was used, the usage count that was charged
 * at checkout.
 *
 * Both steps are claimed atomically through the order document, so this is safe
 * to call from several places at once (expiry job, payment-status read, admin
 * cancellation) and can never release twice.
 */
export async function releaseOrderReservations(order: ReleasableOrder) {
  const released = { inventory: false, couponUsage: false };

  if (await orderRepository.claimInventoryRelease(String(order._id))) {
    await Promise.all(
      order.items.map((item) =>
        productRepository.restockVariant(item.productId, item.sku, item.quantity).catch((err) => {
          logger.error({ err, orderNumber: order.orderNumber, sku: item.sku }, "Failed to restock variant");
        })
      )
    );
    released.inventory = true;
    logger.info({ orderNumber: order.orderNumber }, "inventory released");
  }

  if (order.couponCode && (await orderRepository.claimCouponUsageRelease(String(order._id)))) {
    const coupon = await couponRepository.findByCode(order.couponCode);
    if (coupon) {
      await couponRepository.decrementUsage(String(coupon._id));
      released.couponUsage = true;
      logger.info({ orderNumber: order.orderNumber, couponCode: order.couponCode }, "coupon usage released");
    }
  }

  return released;
}

export async function cancelOrder(orderId: string) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw ApiError.notFound("Không tìm thấy đơn hàng");
  if (order.orderStatus === "cancelled") return order;
  if (order.orderStatus === "completed") throw ApiError.badRequest("Không thể huỷ đơn hàng đã hoàn tất");

  const updated = await orderRepository.updateById(orderId, {
    orderStatus: "cancelled",
    ...(order.paymentStatus === "paid" ? {} : { paymentStatus: order.paymentStatus }),
  });

  await releaseOrderReservations(order);

  return updated;
}
