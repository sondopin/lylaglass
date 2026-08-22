import { ClientSession, FilterQuery } from "mongoose";
import { OrderModel, Order } from "@/models/Order.model";

export interface OrderListFilters {
  page: number;
  limit: number;
  orderStatus?: string;
  paymentStatus?: string;
  shippingStatus?: string;
  q?: string;
}

export interface OrderFilters {
  orderStatus?: string;
  paymentStatus?: string;
  shippingStatus?: string;
  q?: string;
}

function buildOrderFilter(filters: OrderFilters): FilterQuery<Order> {
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
  return query;
}

export const orderRepository = {
  /**
   * Mongoose only honours a session on `create` when the documents are passed
   * as an array, so the single-document call is normalised here rather than at
   * every call site.
   */
  async create(data: Record<string, unknown>, session?: ClientSession) {
    const [order] = await OrderModel.create([data], session ? { session } : {});
    return order;
  },
  findByOrderNumber: (orderNumber: string, session?: ClientSession) =>
    OrderModel.findOne({ orderNumber }).session(session ?? null).lean(),
  findById: (id: string, session?: ClientSession) => OrderModel.findById(id).session(session ?? null).lean(),
  updateById: (id: string, data: Record<string, unknown>, session?: ClientSession) =>
    OrderModel.findByIdAndUpdate(id, data, { new: true, runValidators: true, session }).lean(),
  updateByOrderNumber: (orderNumber: string, data: Record<string, unknown>) =>
    OrderModel.findOneAndUpdate({ orderNumber }, data, { new: true, runValidators: true }).lean(),

  /**
   * Claims the right to return this order's reserved stock. Only the first
   * caller gets the document back, so a retried webhook, the expiry job and an
   * admin cancellation racing each other can never restock twice.
   *
   * This guard is kept even when the caller runs in a transaction: it is what
   * protects the degraded (standalone) mode, and inside a transaction it costs
   * nothing.
   */
  claimInventoryRelease: (id: string, session?: ClientSession) =>
    OrderModel.findOneAndUpdate(
      { _id: id, inventoryReleased: false },
      { inventoryReleased: true },
      { new: true, session }
    ).lean(),

  /** Same one-shot guard for giving back the coupon use counted at checkout. */
  claimCouponUsageRelease: (id: string, session?: ClientSession) =>
    OrderModel.findOneAndUpdate(
      { _id: id, couponUsageReleased: false, couponCode: { $ne: "" } },
      { couponUsageReleased: true },
      { new: true, session }
    ).lean(),

  async list(filters: OrderListFilters) {
    const query = buildOrderFilter(filters);
    const skip = (filters.page - 1) * filters.limit;
    const [items, total] = await Promise.all([
      OrderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(filters.limit).lean(),
      OrderModel.countDocuments(query),
    ]);
    return { items, total };
  },

  /** Every order matching the given filters, unpaginated — used to build the SPX export. */
  findAllByFilters: (filters: OrderFilters) => OrderModel.find(buildOrderFilter(filters)).sort({ createdAt: -1 }).lean(),

  findManyByIds: (ids: string[]) => OrderModel.find({ _id: { $in: ids } }).sort({ createdAt: -1 }).lean(),

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

/**
 * An order as this repository hands it out: a lean plain object, so Mongoose
 * Maps are already flattened. Services should use this rather than the raw
 * schema type, which describes a hydrated document instead.
 */
export type OrderRecord = NonNullable<Awaited<ReturnType<typeof orderRepository.findById>>>;
