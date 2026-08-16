import { FilterQuery } from "mongoose";
import { OrderModel, Order } from "@/models/Order.model";

export interface OrderListFilters {
  page: number;
  limit: number;
  orderStatus?: string;
  paymentStatus?: string;
  shippingStatus?: string;
  q?: string;
}

export const orderRepository = {
  create: (data: Record<string, unknown>) => OrderModel.create(data),
  findByOrderNumber: (orderNumber: string) => OrderModel.findOne({ orderNumber }).lean(),
  findById: (id: string) => OrderModel.findById(id).lean(),
  updateById: (id: string, data: Record<string, unknown>) =>
    OrderModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean(),
  updateByOrderNumber: (orderNumber: string, data: Record<string, unknown>) =>
    OrderModel.findOneAndUpdate({ orderNumber }, data, { new: true, runValidators: true }).lean(),

  async list(filters: OrderListFilters) {
    const query: FilterQuery<Order> = {};
    if (filters.orderStatus) query.orderStatus = filters.orderStatus;
    if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
    if (filters.shippingStatus) query.shippingStatus = filters.shippingStatus;
    if (filters.q) {
      query.$or = [
        { orderNumber: { $regex: filters.q, $options: "i" } },
        { "customer.email": { $regex: filters.q, $options: "i" } },
        { "customer.name": { $regex: filters.q, $options: "i" } },
        { "customer.phone": { $regex: filters.q, $options: "i" } },
      ];
    }
    const skip = (filters.page - 1) * filters.limit;
    const [items, total] = await Promise.all([
      OrderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(filters.limit).lean(),
      OrderModel.countDocuments(query),
    ]);
    return { items, total };
  },

  countAll: () => OrderModel.countDocuments(),
  countByStatus: (orderStatus: string) => OrderModel.countDocuments({ orderStatus }),
  sumRevenue: async () => {
    const result = await OrderModel.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    return result[0]?.total ?? 0;
  },
  recentOrders: (limit = 8) => OrderModel.find().sort({ createdAt: -1 }).limit(limit).lean(),
  revenueByDay: (sinceDate: Date) =>
    OrderModel.aggregate([
      { $match: { paymentStatus: "paid", createdAt: { $gte: sinceDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
};
