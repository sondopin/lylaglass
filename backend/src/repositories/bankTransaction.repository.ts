import { FilterQuery } from "mongoose";
import { BankTransaction, BankTransactionModel } from "@/models/BankTransaction.model";

const DUPLICATE_KEY = 11000;

export interface BankTransactionListFilters {
  page: number;
  limit: number;
  matchStatus?: string;
}

export const bankTransactionRepository = {
  /**
   * Records an incoming transfer. Returns `null` when the provider has already
   * delivered this transaction id — the unique index, not a read-then-write
   * check, is what makes duplicate delivery impossible under concurrency.
   */
  async insertIfNew(data: Record<string, unknown>) {
    try {
      return await BankTransactionModel.create(data);
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === DUPLICATE_KEY) {
        return null;
      }
      throw err;
    }
  },

  findByProviderTransactionId: (provider: string, providerTransactionId: string) =>
    BankTransactionModel.findOne({ provider, providerTransactionId }).lean(),

  updateById: (id: string, data: Record<string, unknown>) =>
    BankTransactionModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean(),

  async list(filters: BankTransactionListFilters) {
    const query: FilterQuery<BankTransaction> = {};
    if (filters.matchStatus) query.matchStatus = filters.matchStatus;

    const skip = (filters.page - 1) * filters.limit;
    const [items, total] = await Promise.all([
      BankTransactionModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(filters.limit).lean(),
      BankTransactionModel.countDocuments(query),
    ]);
    return { items, total };
  },
};
