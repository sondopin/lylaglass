import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { expireOverduePayments, retryPendingConfirmationEmails } from "@/services/payment.service";

let timer: NodeJS.Timeout | null = null;

/**
 * Periodically closes payments whose deadline passed and retries confirmation
 * emails that failed.
 *
 * A customer who closes the browser after checkout never polls again, so
 * without this sweep their reserved stock would stay locked forever. Every
 * action it takes is idempotent, so overlapping runs (or several app instances)
 * cannot double-release or double-send.
 */
export async function runPaymentSweep() {
  try {
    const expiry = await expireOverduePayments();
    if (expiry.expired > 0) logger.info(expiry, "payment expiry sweep");
  } catch (err) {
    logger.error({ err }, "Payment expiry sweep thất bại");
  }

  try {
    const emails = await retryPendingConfirmationEmails();
    if (emails.sent > 0) logger.info(emails, "confirmation email retry sweep");
  } catch (err) {
    logger.error({ err }, "Confirmation email retry sweep thất bại");
  }
}

export function startPaymentExpiryJob() {
  if (timer) return;
  const intervalMs = env.payment.expirySweepIntervalMs;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    logger.warn("PAYMENT_EXPIRY_SWEEP_INTERVAL_MS không hợp lệ, bỏ qua job hết hạn thanh toán");
    return;
  }

  timer = setInterval(() => void runPaymentSweep(), intervalMs);
  // Don't hold the process open just for the sweep.
  timer.unref();
  logger.info({ intervalMs }, "Payment expiry job đã khởi động");
}

export function stopPaymentExpiryJob() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
