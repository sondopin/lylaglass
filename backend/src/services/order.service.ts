import { ApiError } from "@/utils/ApiError";
import { orderRepository } from "@/repositories/order.repository";
import { productRepository } from "@/repositories/product.repository";

export async function getOrderForCustomer(orderNumber: string, email: string) {
  const order = await orderRepository.findByOrderNumber(orderNumber.toUpperCase());
  if (!order || order.customer?.email.toLowerCase() !== email.toLowerCase()) {
    throw ApiError.notFound("Không tìm thấy đơn hàng với thông tin đã cung cấp");
  }
  return order;
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

  if (!order.inventoryReleased) {
    await Promise.all(order.items.map((item) => productRepository.restockVariant(item.productId, item.sku, item.quantity)));
    await orderRepository.updateById(orderId, { inventoryReleased: true });
  }

  return updated;
}
