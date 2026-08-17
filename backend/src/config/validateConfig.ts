import { env } from "./env";
import { logger } from "./logger";

/**
 * Fails fast on a misconfigured payment setup. Money-handling config that is
 * merely "missing" must never silently degrade into a broken checkout, so in
 * production this throws; in development it warns so the app still boots.
 *
 * Only variable *names* are ever reported — never their values.
 */
export function validateRuntimeConfig() {
  const problems: string[] = [];

  if (!env.payment.vietqr.accountNumber) problems.push("VIETQR_ACCOUNT_NUMBER");
  if (!env.payment.vietqr.accountName) problems.push("VIETQR_ACCOUNT_NAME");
  if (!env.payment.vietqr.bankBin) problems.push("VIETQR_BANK_BIN");

  if (env.payment.bankWebhook.authMode === "hmac" && !env.payment.bankWebhook.secret) {
    problems.push("BANK_WEBHOOK_SECRET");
  }
  if (env.payment.bankWebhook.authMode === "apikey" && !env.payment.bankWebhook.apiKey) {
    problems.push("BANK_WEBHOOK_API_KEY");
  }

  if (!Number.isFinite(env.payment.ttlMinutes) || env.payment.ttlMinutes <= 0) {
    problems.push("PAYMENT_TTL_MINUTES");
  }

  if (env.email.provider === "resend" && !env.email.apiKey) problems.push("EMAIL_API_KEY");

  if (problems.length === 0) return;

  const message = `Cấu hình thanh toán chưa hoàn chỉnh, thiếu: ${problems.join(", ")}`;
  if (env.isProduction) throw new Error(message);
  logger.warn({ missing: problems }, message);
}
