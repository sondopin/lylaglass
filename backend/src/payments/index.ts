import { env } from "@/config/env";
import { PaymentProvider } from "./PaymentProvider";
import { MockPaymentProvider } from "./MockPaymentProvider";
import { StripePaymentProvider } from "./StripePaymentProvider";

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;

  switch (env.payment.provider) {
    case "stripe":
      provider = new StripePaymentProvider(env.payment.stripeSecretKey, env.payment.stripeWebhookSecret);
      break;
    case "mock":
    default:
      provider = new MockPaymentProvider();
  }
  return provider;
}

export * from "./PaymentProvider";
