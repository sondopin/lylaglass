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

  if (env.email.provider === "gmail") {
    if (!env.email.gmail.clientId) problems.push("GMAIL_CLIENT_ID");
    if (!env.email.gmail.clientSecret) problems.push("GMAIL_CLIENT_SECRET");
    if (!env.email.gmail.refreshToken) problems.push("GMAIL_REFRESH_TOKEN");
    if (!env.email.gmail.sender) problems.push("GMAIL_SENDER");
  }

  // Not fatal: the storefront runs fine on existing image URLs, only the admin's
  // upload button stops working. Worth saying at boot rather than letting an
  // admin discover it mid-edit.
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    logger.warn(
      "Chưa cấu hình CLOUDINARY_* — chức năng tải ảnh trong trang quản trị sẽ báo lỗi. " +
        "Lưu ý: cấu hình được đọc lúc khởi động, nên sau khi điền key phải KHỞI ĐỘNG LẠI backend."
    );
  }

  // Not fatal — the shop alert is optional and the customer's confirmation is
  // unaffected — but silently never alerting the owner is worth saying out loud.
  if (env.email.orderNotificationRecipients.length === 0) {
    logger.warn(
      "ORDER_NOTIFICATION_EMAILS chưa được cấu hình — chủ shop sẽ KHÔNG nhận được email báo đơn mới đã thanh toán"
    );
  }

  if (problems.length === 0) return;

  const message = `Cấu hình thanh toán chưa hoàn chỉnh, thiếu: ${problems.join(", ")}`;
  if (env.isProduction) throw new Error(message);
  logger.warn({ missing: problems }, message);
}
