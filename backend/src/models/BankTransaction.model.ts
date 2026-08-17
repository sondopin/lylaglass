import { Schema, model, Types, InferSchemaType } from "mongoose";

/**
 * Append-only ledger of every incoming-transfer notification the bank
 * notification provider (SePay) delivers for the shop's TPBank account.
 *
 * It exists for two reasons the Payment document cannot cover:
 *  1. Idempotency at the source — the unique (provider, providerTransactionId)
 *     index rejects replayed webhooks before any business logic runs, including
 *     replays of transfers that match no payment at all.
 *  2. Reconciliation — transfers with a wrong/missing payment code, a wrong
 *     amount, or one arriving after the payment expired have no valid Payment
 *     to live on, but an admin still has to be able to see and handle them.
 */
const bankTransactionSchema = new Schema(
  {
    provider: { type: String, enum: ["sepay"], required: true },
    /** Provider's own transaction id (SePay's `id`). The dedupe key. */
    providerTransactionId: { type: String, required: true },

    gateway: { type: String, default: "" }, // bank name reported by the provider
    accountNumber: { type: String, default: "" },
    subAccount: { type: String, default: "" },
    transferType: { type: String, enum: ["in", "out"], required: true },
    transferAmount: { type: Number, required: true },
    accumulated: { type: Number, default: 0 },
    /** Payment code the provider extracted from the memo, when configured. */
    code: { type: String, default: "" },
    content: { type: String, default: "" },
    description: { type: String, default: "" },
    referenceCode: { type: String, default: "" },
    transactionDate: { type: Date },

    matchStatus: {
      type: String,
      enum: ["matched", "unmatched", "rejected", "ignored"],
      required: true,
      index: true,
    },
    /** Why a transfer was not applied — wrong amount, expired payment, ... */
    matchNote: { type: String, default: "" },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    /** Set once an admin has dealt with an anomalous transfer. */
    resolvedAt: { type: Date },

    rawPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

bankTransactionSchema.index({ provider: 1, providerTransactionId: 1 }, { unique: true });
bankTransactionSchema.index({ createdAt: -1 });

export type BankTransaction = InferSchemaType<typeof bankTransactionSchema> & { _id: Types.ObjectId };
export const BankTransactionModel = model("BankTransaction", bankTransactionSchema);
