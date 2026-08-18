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
   * Records an incoming transfer, or reports that it was already recorded.
   *
   * The unique `(provider, providerTransactionId)` index — not a read-then-write
   * check — is what makes duplicate delivery impossible under concurrency: two
   * simultaneous deliveries of the same transfer both attempt the insert and
   * exactly one wins.
   *
   * On a duplicate the *existing* record is returned rather than a bare `null`,
   * so the caller can tell apart the two very different cases behind it:
   *  - already reconciled  → genuinely nothing to do
   *  - recorded but never reconciled (the process died mid-webhook, or the
   *    reconciliation threw) → the provider's retry must be allowed to finish
   *    the job instead of being swallowed, otherwise a real payment is lost.
   */
  async insertIfNew(data: Record<string, unknown>): Promise<{ record: BankTransaction; isNew: boolean } | null> {
    try {
      const created = await BankTransactionModel.create(data);
      return { record: created.toObject() as BankTransaction, isNew: true };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === DUPLICATE_KEY) {
        const existing = (await BankTransactionModel.findOne({
          provider: data.provider,
          providerTransactionId: data.providerTransactionId,
        }).lean()) as BankTransaction | null;
        return existing ? { record: existing, isNew: false } : null;
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
