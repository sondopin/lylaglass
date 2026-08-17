import { env } from "@/config/env";
import { PaymentProvider } from "./PaymentProvider";
import { BankNotificationProvider } from "./BankNotificationProvider";
import { VietQRPaymentProvider } from "./VietQRPaymentProvider";
import { SePayBankNotificationProvider } from "./SePayBankNotificationProvider";

let paymentProvider: PaymentProvider | null = null;
let bankNotificationProvider: BankNotificationProvider | null = null;

/** Creates payment instructions (the VietQR the customer transfers against). */
export function getPaymentProvider(): PaymentProvider {
  if (paymentProvider) return paymentProvider;

  switch (env.payment.provider) {
    case "vietqr":
    default:
      paymentProvider = new VietQRPaymentProvider({
        bin: env.payment.vietqr.bankBin,
        code: env.payment.vietqr.bankCode,
        name: env.payment.vietqr.bankName,
        accountNumber: env.payment.vietqr.accountNumber,
        accountName: env.payment.vietqr.accountName,
      });
  }
  return paymentProvider;
}

/**
 * Confirms money actually arrived in the shop's bank account. Deliberately a
 * separate registry from the payment provider: the QR vendor and the
 * balance-notification vendor are independent choices.
 */
export function getBankNotificationProvider(): BankNotificationProvider {
  if (bankNotificationProvider) return bankNotificationProvider;

  switch (env.payment.bankWebhook.provider) {
    case "sepay":
    default:
      bankNotificationProvider = new SePayBankNotificationProvider({
        mode: env.payment.bankWebhook.authMode,
        secret: env.payment.bankWebhook.secret,
        apiKey: env.payment.bankWebhook.apiKey,
        timestampToleranceSeconds: env.payment.bankWebhook.timestampToleranceSeconds,
      });
  }
  return bankNotificationProvider;
}

export * from "./PaymentProvider";
export * from "./BankNotificationProvider";
