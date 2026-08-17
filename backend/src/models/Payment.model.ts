import { Schema, model, Types, InferSchemaType } from "mongoose";

const paymentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    provider: { type: String, enum: ["vietqr"], required: true },
    /**
     * Provider-side identifier of this payment intent. VietQR has no external
     * gateway session, so it mirrors `paymentCode` — the value the customer
     * puts in the transfer memo and the only thing we reconcile against.
     */
    intentId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "VND" },
    status: {
      type: String,
      enum: ["requires_action", "processing", "succeeded", "failed", "expired", "refunded"],
      default: "processing",
      index: true,
    },
    method: { type: String, enum: ["bank_transfer"], default: "bank_transfer" },

    // --- VietQR / bank transfer details (all generated server-side) ---
    /** Unique transfer memo used to match an incoming transfer to this payment. */
    paymentCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    bankBin: { type: String, default: "" }, // NAPAS BIN encoded in the QR (TPBank = 970423)
    bankCode: { type: String, default: "" }, // short code, display only (TPB)
    bankName: { type: String, default: "" },
    bankAccountNumber: { type: String, default: "" },
    bankAccountName: { type: String, default: "" },
    /** Raw EMVCo/VietQR string the QR image encodes. */
    qrPayload: { type: String, default: "" },
    /** Server-owned deadline, derived from creation time — never from the client. */
    expiresAt: { type: Date, required: true, index: true },
    paidAt: { type: Date },

    // --- Matched incoming bank transaction (set once, on successful reconciliation) ---
    /** Provider-side transaction id; unique so a replayed webhook can never be applied twice. */
    transactionId: { type: String },
    referenceCode: { type: String, default: "" },
    transactionDate: { type: Date },
    transferredAmount: { type: Number },

    failureReason: { type: String, default: "" },
    /** Set when a transfer arrived but business rules forbid auto-confirming it. */
    needsManualReview: { type: Boolean, default: false, index: true },
    manualReviewReason: { type: String, default: "" },

    // --- Confirmation email to the customer (idempotency + admin visibility) ---
    confirmationEmailStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
      index: true,
    },
    confirmationEmailSentAt: { type: Date },
    confirmationEmailAttempts: { type: Number, default: 0 },
    confirmationEmailError: { type: String, default: "" },

    // --- "New paid order" alert to the shop owner. Tracked separately from the
    // customer email so one failing never blocks or re-sends the other, and
    // "skipped" records that no recipient is configured. ---
    ownerNotificationStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed", "skipped"],
      default: "pending",
      index: true,
    },
    ownerNotificationSentAt: { type: Date },
    ownerNotificationAttempts: { type: Number, default: 0 },
    ownerNotificationError: { type: String, default: "" },

    rawEvent: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Partial unique index: only documents that actually carry a transactionId take
// part, so the many pending payments with no transaction yet don't collide.
paymentSchema.index(
  { transactionId: 1 },
  { unique: true, partialFilterExpression: { transactionId: { $type: "string" } } }
);

export type Payment = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId };
export const PaymentModel = model("Payment", paymentSchema);
