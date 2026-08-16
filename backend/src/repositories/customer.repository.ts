import { CustomerModel } from "@/models/Customer.model";

export const customerRepository = {
  findByEmail: (email: string) => CustomerModel.findOne({ email }).lean(),
  async upsertFromOrder(input: { name: string; email: string; phone: string; orderTotal: number }) {
    return CustomerModel.findOneAndUpdate(
      { email: input.email },
      {
        $set: { name: input.name, phone: input.phone },
        $inc: { ordersCount: 1, totalSpent: input.orderTotal },
        $setOnInsert: { email: input.email },
      },
      { upsert: true, new: true }
    ).lean();
  },
  list: (page: number, limit: number, q?: string) => {
    const query = q
      ? { $or: [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }] }
      : {};
    const skip = (page - 1) * limit;
    return Promise.all([
      CustomerModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CustomerModel.countDocuments(query),
    ]);
  },
  findById: (id: string) => CustomerModel.findById(id).lean(),
  countAll: () => CustomerModel.countDocuments(),
};
