import { PaymentModel } from "@/models/Payment.model";

/** A payment in one of these states will never transition again. */
export const TERMINAL_PAYMENT_STATUSES = ["succeeded", "failed", "expired", "refunded"] as const;

/**
 * The emails a successful payment triggers. Each value is also the field-name
 * prefix on Payment (`<kind>Status`, `<kind>SentAt`, `<kind>Attempts`,
 * `<kind>Error`), so both kinds share one set of atomic claim helpers.
 */
export type PaymentEmailKind = "confirmationEmail" | "ownerNotification";

export interface MarkSucceededInput {
  transactionId: string;
  referenceCode: string;
  transactionDate: Date;
  transferredAmount: number;
  rawEvent: unknown;
}

export const paymentRepository = {
  create: (data: Record<string, unknown>) => PaymentModel.create(data),
  findByIdempotencyKey: (key: string) => PaymentModel.findOne({ idempotencyKey: key }).lean(),
  findByIntentId: (intentId: string) => PaymentModel.findOne({ intentId }).lean(),
  findByPaymentCode: (paymentCode: string) => PaymentModel.findOne({ paymentCode: paymentCode.toUpperCase() }).lean(),
  findByOrderId: (orderId: string) => PaymentModel.findOne({ orderId }).sort({ createdAt: -1 }).lean(),
  findById: (id: string) => PaymentModel.findById(id).lean(),
  updateById: (id: string, data: Record<string, unknown>) =>
    PaymentModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean(),

  /**
   * Atomically moves a still-open payment to `succeeded`. The status guard is
   * part of the query, so concurrent webhook deliveries for the same transfer
   * can never both win — the loser gets `null` and stops.
   */
  markSucceeded: (id: string, input: MarkSucceededInput) =>
    PaymentModel.findOneAndUpdate(
      { _id: id, status: { $nin: TERMINAL_PAYMENT_STATUSES } },
      {
        status: "succeeded",
        paidAt: new Date(),
        transactionId: input.transactionId,
        referenceCode: input.referenceCode,
        transactionDate: input.transactionDate,
        transferredAmount: input.transferredAmount,
        failureReason: "",
        rawEvent: input.rawEvent,
      },
      { new: true, runValidators: true }
    ).lean(),

  /** Atomically closes a still-open payment as `expired` or `failed`. */
  markClosed: (id: string, status: "expired" | "failed", failureReason: string) =>
    PaymentModel.findOneAndUpdate(
      { _id: id, status: { $nin: TERMINAL_PAYMENT_STATUSES } },
      { status, failureReason },
      { new: true, runValidators: true }
    ).lean(),

  flagForManualReview: (id: string, reason: string) =>
    PaymentModel.findByIdAndUpdate(id, { needsManualReview: true, manualReviewReason: reason }, { new: true }).lean(),

  /** Payments past their deadline that were never paid. Drives the expiry job. */
  findExpiredOpen: (now: Date, limit = 100) =>
    PaymentModel.find({ status: { $nin: TERMINAL_PAYMENT_STATUSES }, expiresAt: { $lte: now } })
      .limit(limit)
      .lean(),

  /**
   * Claims the right to send one of a payment's emails. Succeeds for exactly one
   * caller: the `pending`/`failed` guard means retried webhooks (and the retry
   * job) can never send a second copy of the same email.
   *
   * The two kinds are tracked independently, so a failing owner alert never
   * blocks or duplicates the customer's confirmation.
   */
  claimEmailSend: (id: string, kind: PaymentEmailKind, maxAttempts: number) =>
    PaymentModel.findOneAndUpdate(
      {
        _id: id,
        status: "succeeded",
        [`${kind}Status`]: { $in: ["pending", "failed"] },
        [`${kind}Attempts`]: { $lt: maxAttempts },
      },
      { [`${kind}Status`]: "sending", $inc: { [`${kind}Attempts`]: 1 } },
      { new: true }
    ).lean(),

  markEmailSent: (id: string, kind: PaymentEmailKind) =>
    PaymentModel.findByIdAndUpdate(
      id,
      { [`${kind}Status`]: "sent", [`${kind}SentAt`]: new Date(), [`${kind}Error`]: "" },
      { new: true }
    ).lean(),

  markEmailFailed: (id: string, kind: PaymentEmailKind, error: string) =>
    PaymentModel.findByIdAndUpdate(id, { [`${kind}Status`]: "failed", [`${kind}Error`]: error }, { new: true }).lean(),

  /** Marks an email as deliberately not sent (e.g. no recipient configured). */
  markEmailSkipped: (id: string, kind: PaymentEmailKind, reason: string) =>
    PaymentModel.findByIdAndUpdate(id, { [`${kind}Status`]: "skipped", [`${kind}Error`]: reason }, { new: true }).lean(),

  /** Paid payments whose email of this kind still needs another attempt. */
  findEmailRetryable: (kind: PaymentEmailKind, maxAttempts: number, limit = 50) =>
    PaymentModel.find({
      status: "succeeded",
      [`${kind}Status`]: { $in: ["pending", "failed"] },
      [`${kind}Attempts`]: { $lt: maxAttempts },
    })
      .limit(limit)
      .lean(),
};

/** A payment as this repository hands it out (lean plain object). */
export type PaymentRecord = NonNullable<Awaited<ReturnType<typeof paymentRepository.findById>>>;
