import { z } from "zod";

/**
 * SePay incoming-transfer webhook payload.
 * Field names and types follow SePay's published webhook contract:
 * https://docs.sepay.vn/tich-hop-webhooks.html
 *
 * Nullable/optional fields are normalised to empty strings so downstream code
 * never has to deal with three different kinds of "missing".
 */
const optionalText = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => (value === null || value === undefined ? "" : String(value)));

export const sePayWebhookSchema = z.object({
  /** Provider-side transaction id — used as the idempotency key. */
  id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  gateway: optionalText,
  /** "YYYY-MM-DD HH:mm:ss" in Vietnam local time (UTC+7). */
  transactionDate: optionalText,
  accountNumber: optionalText,
  subAccount: optionalText,
  /** Payment code SePay extracted from the memo when a prefix is configured. */
  code: optionalText,
  content: optionalText,
  transferType: z.enum(["in", "out"]),
  description: optionalText,
  transferAmount: z.coerce.number(),
  accumulated: z.coerce.number().optional().default(0),
  referenceCode: optionalText,
});

export type SePayWebhookPayload = z.infer<typeof sePayWebhookSchema>;

export const paymentStatusQuerySchema = z.object({
  email: z.string().email(),
  /**
   * Rendering the QR costs CPU, and a polling client only needs it once. The
   * payment page asks for it on first load/reload and omits it while polling.
   */
  includeQr: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) => value === "true" || value === "1"),
});

export type PaymentStatusQuery = z.infer<typeof paymentStatusQuerySchema>;

export const listBankTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  matchStatus: z.enum(["matched", "unmatched", "rejected", "ignored"]).optional(),
});
