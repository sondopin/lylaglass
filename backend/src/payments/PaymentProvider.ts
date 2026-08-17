export interface CreatePaymentIntentInput {
  orderId: string;
  orderNumber: string;
  amount: number; // whole VND — the smallest-unit convention does not apply to VND
  currency: string;
  customerEmail: string;
  /** Unique transfer memo the customer must send the money with. */
  paymentCode: string;
  /** Server-computed deadline for this payment. */
  expiresAt: Date;
}

export interface PaymentBankAccount {
  /** NAPAS BIN encoded in the QR (TPBank = 970423). */
  bin: string;
  /** Short bank code, display only (TPB). */
  code: string;
  name: string;
  accountNumber: string;
  accountName: string;
}

export interface CreatePaymentIntentResult {
  intentId: string;
  status: "requires_action" | "processing" | "succeeded" | "failed";
  method: "bank_transfer";
  bank: PaymentBankAccount;
  /** Raw VietQR/EMVCo string the QR image encodes. */
  qrPayload: string;
  /** Rendered QR as a self-contained data URI, ready for an <img src>. */
  qrCodeDataUrl: string;
}

/**
 * A payment provider turns an order into everything the customer needs in order
 * to pay. It deliberately knows nothing about *confirming* payment: for bank
 * transfer the money arrives out-of-band and is confirmed by a
 * BankNotificationProvider, so the two concerns live behind separate contracts
 * and can be swapped independently.
 *
 * Order/Payment services only ever talk to this interface, so adding a gateway
 * later is a new class plus a registration in payments/index.ts.
 */
export interface PaymentProvider {
  readonly name: string;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;
}
