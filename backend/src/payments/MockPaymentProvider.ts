import { nanoid } from "nanoid";
import {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentProvider,
  VerifiedWebhookEvent,
} from "./PaymentProvider";

/**
 * Local-dev / demo provider. Simulates an external gateway without any
 * network calls: creating an intent immediately "succeeds", and the webhook
 * endpoint accepts a matching intentId with no signature (dev only — never
 * wired up when PAYMENT_PROVIDER !== "mock").
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    const intentId = `mock_${nanoid(16)}`;
    return {
      intentId,
      status: "processing",
      redirectUrl: `/thanh-toan/gia-lap?intent=${intentId}&order=${input.orderNumber}&amount=${input.amount}`,
    };
  }

  async verifyWebhook(
    rawBody: Buffer,
    _headers: Record<string, string | string[] | undefined>
  ): Promise<VerifiedWebhookEvent> {
    const payload = JSON.parse(rawBody.toString("utf-8")) as {
      intentId: string;
      amount: number;
      currency: string;
      outcome?: "succeeded" | "failed";
    };
    return {
      intentId: payload.intentId,
      status: payload.outcome ?? "succeeded",
      amount: payload.amount,
      currency: payload.currency,
      method: "mock",
      raw: payload,
    };
  }
}
