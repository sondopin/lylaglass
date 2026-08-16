import { ApiError } from "@/utils/ApiError";
import {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentProvider,
  VerifiedWebhookEvent,
} from "./PaymentProvider";

/**
 * Production-ready shape for Stripe. Left as a stub with clear TODOs so
 * enabling it later is a config change, not an Order-system rewrite — the
 * whole point of the PaymentProvider abstraction.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";

  constructor(private readonly secretKey: string, private readonly webhookSecret: string) {}

  async createPaymentIntent(_input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    if (!this.secretKey) {
      throw ApiError.internal("Stripe chưa được cấu hình (thiếu STRIPE_SECRET_KEY)");
    }
    // TODO: const stripe = new Stripe(this.secretKey);
    // const intent = await stripe.paymentIntents.create({ amount: input.amount, currency: input.currency, ... });
    // return { intentId: intent.id, status: mapStatus(intent.status), clientSecret: intent.client_secret };
    throw ApiError.internal("Stripe provider chưa được triển khai đầy đủ");
  }

  async verifyWebhook(
    _rawBody: Buffer,
    _headers: Record<string, string | string[] | undefined>
  ): Promise<VerifiedWebhookEvent> {
    if (!this.webhookSecret) {
      throw ApiError.internal("Stripe chưa được cấu hình (thiếu STRIPE_WEBHOOK_SECRET)");
    }
    // TODO: const event = stripe.webhooks.constructEvent(rawBody, headers['stripe-signature'], this.webhookSecret);
    throw ApiError.internal("Stripe provider chưa được triển khai đầy đủ");
  }
}
