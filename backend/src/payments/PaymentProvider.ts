export interface CreatePaymentIntentInput {
  orderId: string;
  orderNumber: string;
  amount: number; // smallest currency unit is not used for VND (no decimals); amount is whole VND
  currency: string;
  customerEmail: string;
}

export interface CreatePaymentIntentResult {
  intentId: string;
  status: "requires_action" | "processing" | "succeeded" | "failed";
  clientSecret?: string; // opaque token/URL the frontend uses to complete payment
  redirectUrl?: string;
}

export interface VerifiedWebhookEvent {
  intentId: string;
  status: "succeeded" | "failed" | "refunded";
  amount: number;
  currency: string;
  method?: string;
  last4?: string;
  failureReason?: string;
  raw: unknown;
}

/**
 * Every payment gateway (Stripe, VNPay, MoMo, ...) implements this contract.
 * The Order/Payment services only ever talk to this interface, so swapping
 * providers never requires touching order logic — only a new provider class
 * plus a registration in payments/index.ts.
 */
export interface PaymentProvider {
  readonly name: string;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;
  /** Verifies the raw webhook request is authentic and normalizes its payload. Throws if the signature is invalid. */
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<VerifiedWebhookEvent>;
}
