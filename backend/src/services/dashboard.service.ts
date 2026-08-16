import { orderRepository } from "@/repositories/order.repository";
import { productRepository } from "@/repositories/product.repository";
import { customerRepository } from "@/repositories/customer.repository";

export async function getDashboardStats() {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [totalOrders, pendingOrders, totalRevenue, totalProducts, lowStockCount, totalCustomers, recentOrders, revenueSeries] =
    await Promise.all([
      orderRepository.countAll(),
      orderRepository.countByStatus("pending"),
      orderRepository.sumRevenue(),
      productRepository.countAll(),
      productRepository.countLowStock(5),
      customerRepository.countAll(),
      orderRepository.recentOrders(8),
      orderRepository.revenueByDay(since),
    ]);

  return {
    totalOrders,
    pendingOrders,
    totalRevenue,
    totalProducts,
    lowStockCount,
    totalCustomers,
    recentOrders,
    revenueSeries,
  };
}
