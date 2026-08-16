import { PaymentModel } from "@/models/Payment.model";

export const paymentRepository = {
  create: (data: Record<string, unknown>) => PaymentModel.create(data),
  findByIdempotencyKey: (key: string) => PaymentModel.findOne({ idempotencyKey: key }).lean(),
  findByIntentId: (intentId: string) => PaymentModel.findOne({ intentId }).lean(),
  updateById: (id: string, data: Record<string, unknown>) =>
    PaymentModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean(),
  findById: (id: string) => PaymentModel.findById(id).lean(),
};
