/**
 * A single incoming/outgoing transaction on the shop's bank account, normalised
 * from whatever shape the notification provider delivers.
 */
export interface BankTransactionEvent {
  /** Provider-side transaction id. The idempotency key for the whole flow. */
  transactionId: string;
  /** Bank the provider reports the transaction for (e.g. "TPBank"). */
  gateway: string;
  /** Beneficiary account the money landed in. */
  accountNumber: string;
  subAccount: string;
  /** "in" = money received. Only incoming transfers can ever confirm a payment. */
  transferType: "in" | "out";
  /** Whole VND actually transferred. */
  transferAmount: number;
  accumulated: number;
  /** Payment code the provider pre-extracted from the memo, when available. */
  code: string;
  /** Raw transfer memo. */
  content: string;
  description: string;
  referenceCode: string;
  transactionDate: Date;
  raw: unknown;
}

/**
 * Receives balance-change notifications for the shop's bank account and turns a
 * raw, untrusted HTTP request into a verified BankTransactionEvent.
 *
 * Kept separate from PaymentProvider on purpose: generating a QR and observing
 * money arriving are different responsibilities, often supplied by different
 * vendors, and only the latter may ever mark a payment as paid.
 */
export interface BankNotificationProvider {
  readonly name: string;
  /**
   * Verifies the request really came from the provider and normalises its body.
   * Must throw (401) on a failed signature/key check, and (400) on a payload
   * that does not match the documented schema.
   */
  verifyAndParse(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): Promise<BankTransactionEvent>;
}
