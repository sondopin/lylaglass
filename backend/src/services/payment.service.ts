import { Types } from "mongoose";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { getBankNotificationProvider, getPaymentProvider, BankTransactionEvent } from "@/payments";
import { renderQrCodeDataUrl } from "@/payments/qrImage";
import { paymentRepository, PaymentRecord, PaymentEmailKind } from "@/repositories/payment.repository";
import { orderRepository, OrderRecord } from "@/repositories/order.repository";
import { bankTransactionRepository } from "@/repositories/bankTransaction.repository";
import { ApiError } from "@/utils/ApiError";
import { extractPaymentCodes, generatePaymentCode } from "@/utils/paymentCode";
import { releaseOrderReservations } from "./order.service";
import { sendPaymentConfirmationEmail, sendNewOrderNotificationEmail } from "./email.service";

/**
 * The minimum an order must expose to have a payment created for it. Narrow so
 * a freshly created document and a lean record are both acceptable.
 */
export interface PayableOrder {
  _id: Types.ObjectId;
  orderNumber: string;
  total: number;
  currency: string;
  customer?: { email?: string } | null;
}

/**
 * What the frontend is allowed to see about a payment. Internal reconciliation
 * data (raw provider events, review flags, email bookkeeping) stays server-side.
 */
export interface PublicPaymentView {
  id: string;
  provider: string;
  method: string;
  status: PaymentRecord["status"];
  amount: number;
  currency: string;
  paymentCode: string;
  bank: {
    code: string;
    name: string;
    accountNumber: string;
    accountName: string;
  };
  qrPayload: string;
  qrCodeDataUrl: string;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
}

export function toPublicPaymentView(payment: PaymentRecord): PublicPaymentView {
  return {
    id: String(payment._id),
    provider: payment.provider,
    method: payment.method,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    paymentCode: payment.paymentCode,
    bank: {
      code: payment.bankCode,
      name: payment.bankName,
      accountNumber: payment.bankAccountNumber,
      accountName: payment.bankAccountName,
    },
    qrPayload: payment.qrPayload,
    // Re-rendered on read so the QR image never has to be stored.
    qrCodeDataUrl: "",
    expiresAt: (payment.expiresAt as Date).toISOString(),
    paidAt: payment.paidAt ? (payment.paidAt as Date).toISOString() : null,
    createdAt: (payment.createdAt as Date).toISOString(),
  };
}

/**
 * Creates the Payment for a freshly placed order and generates its VietQR.
 *
 * The TTL deadline is computed here, from server time, so reloading the payment
 * page cannot extend it.
 */
export async function createPaymentForOrder(order: PayableOrder) {
  const paymentCode = generatePaymentCode();
  const expiresAt = new Date(Date.now() + env.payment.ttlMinutes * 60_000);

  const provider = getPaymentProvider();
  const intent = await provider.createPaymentIntent({
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    amount: order.total,
    currency: order.currency,
    customerEmail: order.customer?.email ?? "",
    paymentCode,
    expiresAt,
  });

  const payment = await paymentRepository.create({
    orderId: order._id,
    provider: provider.name,
    intentId: intent.intentId,
    // One payment per order: a refreshed checkout can never spawn a second one.
    idempotencyKey: `checkout_${order._id}`,
    amount: order.total,
    currency: order.currency,
    status: intent.status,
    method: intent.method,
    paymentCode,
    bankBin: intent.bank.bin,
    bankCode: intent.bank.code,
    bankName: intent.bank.name,
    bankAccountNumber: intent.bank.accountNumber,
    bankAccountName: intent.bank.accountName,
    qrPayload: intent.qrPayload,
    expiresAt,
  });

  logger.info(
    { orderNumber: order.orderNumber, paymentCode, amount: order.total, expiresAt },
    "payment created (awaiting bank transfer)"
  );

  return { payment: payment.toObject() as PaymentRecord, qrCodeDataUrl: intent.qrCodeDataUrl };
}

/**
 * Builds the customer-facing payment view, optionally re-rendering the QR image
 * so it survives a page reload. The QR is only rendered when asked for, because
 * a client polling every few seconds needs it exactly once.
 */
export async function renderPaymentView(payment: PaymentRecord, includeQr: boolean): Promise<PublicPaymentView> {
  const view = toPublicPaymentView(payment);
  // Only a payment that is still open needs a scannable QR.
  if (includeQr && payment.qrPayload && !isTerminal(payment)) {
    view.qrCodeDataUrl = await renderQrCodeDataUrl(payment.qrPayload);
  }
  return view;
}

function isTerminal(payment: PaymentRecord): boolean {
  return ["succeeded", "failed", "expired", "refunded"].includes(payment.status);
}

/**
 * Closes a payment whose deadline has passed and unwinds everything checkout
 * reserved. Safe to call repeatedly and concurrently: the status transition and
 * both release steps are guarded by atomic claims.
 */
export async function expirePayment(payment: PaymentRecord, reason = "Hết thời gian chờ thanh toán") {
  const closed = await paymentRepository.markClosed(String(payment._id), "expired", reason);
  if (!closed) {
    // Someone else finalised it first (paid, or already expired) — nothing to do.
    return null;
  }

  const order = await orderRepository.findById(String(payment.orderId));
  if (!order) {
    logger.error({ paymentId: String(payment._id) }, "payment expired but order no longer exists");
    return closed;
  }

  await orderRepository.updateById(String(order._id), { paymentStatus: "failed", orderStatus: "cancelled" });
  await releaseOrderReservations(order);

  logger.info(
    { orderNumber: order.orderNumber, paymentCode: payment.paymentCode },
    "payment expired - order cancelled, inventory and coupon released"
  );
  return closed;
}

/** Expires every timed-out payment. Driven by the background sweep job. */
export async function expireOverduePayments(now = new Date()) {
  const overdue = (await paymentRepository.findExpiredOpen(now)) as PaymentRecord[];
  let expired = 0;
  for (const payment of overdue) {
    const result = await expirePayment(payment);
    if (result) expired++;
  }
  return { scanned: overdue.length, expired };
}

/**
 * Marks a payment paid and confirms its order. Called only from the bank
 * webhook, only after every reconciliation check passed.
 */
async function settlePayment(payment: PaymentRecord, order: OrderRecord, event: BankTransactionEvent) {
  const succeeded = await paymentRepository.markSucceeded(String(payment._id), {
    transactionId: event.transactionId,
    referenceCode: event.referenceCode,
    transactionDate: event.transactionDate,
    transferredAmount: event.transferAmount,
    rawEvent: event.raw,
  });

  if (!succeeded) {
    // Lost the race against a concurrent delivery of the same transfer.
    logger.info({ paymentCode: payment.paymentCode }, "payment already processed");
    return null;
  }

  logger.info(
    { paymentCode: payment.paymentCode, transactionId: event.transactionId, amount: event.transferAmount },
    "payment marked paid"
  );

  // Stock was already reserved at checkout — confirming must never decrement again.
  await orderRepository.updateById(String(order._id), {
    paymentStatus: "paid",
    orderStatus: order.orderStatus === "pending" ? "confirmed" : order.orderStatus,
  });
  logger.info({ orderNumber: order.orderNumber }, "order confirmed");

  // Both emails are attempted; neither can fail the other, and neither can fail
  // the payment.
  await deliverConfirmationEmail(succeeded as PaymentRecord, order);
  await deliverOwnerNotification(succeeded as PaymentRecord, order);
  return succeeded as PaymentRecord;
}

/** How each kind of payment email is addressed, sent and logged. */
const EMAIL_DELIVERIES: Record<
  PaymentEmailKind,
  { label: string; send: (order: OrderRecord, payment: PaymentRecord) => Promise<unknown>; isEnabled: () => boolean }
> = {
  confirmationEmail: {
    label: "email xác nhận cho khách",
    send: sendPaymentConfirmationEmail,
    isEnabled: () => true,
  },
  ownerNotification: {
    label: "email thông báo đơn mới cho chủ shop",
    send: sendNewOrderNotificationEmail,
    // Optional feature: no recipient configured means nothing to send.
    isEnabled: () => env.email.orderNotificationRecipients.length > 0,
  },
};

/**
 * Sends one of a payment's emails, at most once.
 *
 * A failure here is logged and recorded on the Payment but never propagated:
 * the money has arrived, so the payment stays `succeeded` and the retry job
 * picks the email up again.
 */
async function deliverPaymentEmail(kind: PaymentEmailKind, payment: PaymentRecord, order: OrderRecord) {
  const delivery = EMAIL_DELIVERIES[kind];

  if (!delivery.isEnabled()) {
    // Recorded once so the retry sweep stops considering this payment.
    await paymentRepository.markEmailSkipped(String(payment._id), kind, "Chưa cấu hình người nhận");
    logger.info({ orderNumber: order.orderNumber, kind }, "email skipped because no recipient is configured");
    return false;
  }

  const claimed = await paymentRepository.claimEmailSend(String(payment._id), kind, env.email.maxAttempts);
  if (!claimed) {
    logger.info({ orderNumber: order.orderNumber, kind }, "email skipped because already sent");
    return false;
  }

  try {
    await delivery.send(order, claimed as PaymentRecord);
    await paymentRepository.markEmailSent(String(payment._id), kind);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await paymentRepository.markEmailFailed(String(payment._id), kind, message.slice(0, 500));
    logger.error(
      { err, orderNumber: order.orderNumber, kind, attempts: (claimed as PaymentRecord)[`${kind}Attempts`] },
      `Gửi ${delivery.label} thất bại - payment vẫn là paid, sẽ thử lại`
    );
    return false;
  }
}

/** Confirmation to the customer, at most once per payment. */
export function deliverConfirmationEmail(payment: PaymentRecord, order: OrderRecord) {
  return deliverPaymentEmail("confirmationEmail", payment, order);
}

/** "New paid order" alert to the shop, at most once per payment. */
export function deliverOwnerNotification(payment: PaymentRecord, order: OrderRecord) {
  return deliverPaymentEmail("ownerNotification", payment, order);
}

/** Retries payment emails that failed earlier. Driven by the sweep job. */
export async function retryPendingConfirmationEmails() {
  let scanned = 0;
  let sent = 0;

  for (const kind of Object.keys(EMAIL_DELIVERIES) as PaymentEmailKind[]) {
    const pending = (await paymentRepository.findEmailRetryable(kind, env.email.maxAttempts)) as PaymentRecord[];
    scanned += pending.length;
    for (const payment of pending) {
      const order = await orderRepository.findById(String(payment.orderId));
      if (!order) continue;
      if (await deliverPaymentEmail(kind, payment, order as OrderRecord)) sent++;
    }
  }

  return { scanned, sent };
}

interface WebhookOutcome {
  matchStatus: "matched" | "unmatched" | "rejected" | "ignored";
  note: string;
  paymentId?: Types.ObjectId;
  orderId?: Types.ObjectId;
}

/**
 * Processes one incoming-transfer notification from the bank notification
 * provider. This is the ONLY path that can mark a payment paid.
 *
 * Every transfer is recorded first, so nothing is ever lost, then matched
 * strictly by payment code. A transfer is applied only when all of these hold:
 *   1. the request authenticated as coming from the provider (done by the provider)
 *   2. it is an incoming transfer
 *   3. it landed in the configured beneficiary account
 *   4. its memo carries a payment code that resolves to a real Payment
 *   5. the provider has not delivered this transaction before
 *   6. the transferred amount equals the payment amount exactly
 *   7. the payment is not already in a terminal state
 *   8. the payment has not passed its deadline
 */
export async function handleBankWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
  const provider = getBankNotificationProvider();
  const event = await provider.verifyAndParse(rawBody, headers);

  logger.info(
    {
      provider: provider.name,
      transactionId: event.transactionId,
      transferType: event.transferType,
      amount: event.transferAmount,
    },
    "payment webhook received"
  );

  // Recorded before any matching: the unique (provider, transactionId) index is
  // what makes a replayed delivery a no-op, even for transfers we cannot match.
  const recorded = await bankTransactionRepository.insertIfNew({
    provider: provider.name,
    providerTransactionId: event.transactionId,
    gateway: event.gateway,
    accountNumber: event.accountNumber,
    subAccount: event.subAccount,
    transferType: event.transferType,
    transferAmount: event.transferAmount,
    accumulated: event.accumulated,
    code: event.code,
    content: event.content,
    description: event.description,
    referenceCode: event.referenceCode,
    transactionDate: event.transactionDate,
    matchStatus: "unmatched",
    rawPayload: event.raw,
  });

  if (!recorded) {
    logger.info({ transactionId: event.transactionId }, "payment already processed (duplicate webhook ignored)");
    return { processed: false, duplicate: true, status: "duplicate" as const };
  }

  const outcome = await reconcileTransaction(event);

  await bankTransactionRepository.updateById(String(recorded._id), {
    matchStatus: outcome.matchStatus,
    matchNote: outcome.note,
    ...(outcome.paymentId ? { paymentId: outcome.paymentId } : {}),
    ...(outcome.orderId ? { orderId: outcome.orderId } : {}),
  });

  return {
    processed: outcome.matchStatus === "matched",
    duplicate: false,
    status: outcome.matchStatus,
  };
}

async function reconcileTransaction(event: BankTransactionEvent): Promise<WebhookOutcome> {
  // (2) Outgoing money can never confirm a customer payment.
  if (event.transferType !== "in") {
    logger.info({ transactionId: event.transactionId }, "payment rejected - not an incoming transfer");
    return { matchStatus: "ignored", note: "Giao dịch tiền ra, không liên quan thanh toán đơn hàng" };
  }

  // (3) Must be the beneficiary account we actually asked customers to pay into.
  const expectedAccount = env.payment.vietqr.accountNumber;
  if (expectedAccount && !accountMatches(event.accountNumber, expectedAccount) && !accountMatches(event.subAccount, expectedAccount)) {
    logger.warn({ transactionId: event.transactionId }, "payment rejected - wrong bank account");
    return { matchStatus: "rejected", note: "Tiền vào tài khoản không phải tài khoản nhận thanh toán đã cấu hình" };
  }

  // (4) Match strictly by payment code — never by amount, which is ambiguous
  // across orders that happen to cost the same.
  const candidates = extractPaymentCodes(event.code, event.content, event.description);
  let payment: PaymentRecord | null = null;
  for (const candidate of candidates) {
    const found = (await paymentRepository.findByPaymentCode(candidate)) as PaymentRecord | null;
    if (found) {
      payment = found;
      break;
    }
  }

  if (!payment) {
    logger.warn(
      { transactionId: event.transactionId, candidates },
      "payment rejected - wrong payment code (no matching payment)"
    );
    return {
      matchStatus: "unmatched",
      note: "Không tìm thấy mã thanh toán hợp lệ trong nội dung chuyển khoản",
    };
  }

  const order = (await orderRepository.findById(String(payment.orderId))) as OrderRecord | null;
  if (!order) {
    logger.error({ paymentCode: payment.paymentCode }, "payment matched but order no longer exists");
    return {
      matchStatus: "rejected",
      note: "Payment khớp nhưng đơn hàng không còn tồn tại",
      paymentId: payment._id,
    };
  }

  logger.info(
    { paymentCode: payment.paymentCode, orderNumber: order.orderNumber, transactionId: event.transactionId },
    "payment matched"
  );

  // (7) Terminal payments never transition again.
  if (isTerminal(payment)) {
    if (payment.status === "succeeded") {
      logger.info({ paymentCode: payment.paymentCode }, "payment already processed");
      return {
        matchStatus: "ignored",
        note: "Payment đã được thanh toán trước đó",
        paymentId: payment._id,
        orderId: order._id,
      };
    }

    // A real transfer arriving after we expired/cancelled the order. Inventory
    // and coupon usage were already returned, so auto-confirming could oversell.
    // Business rule: never auto-confirm; flag it for a human to refund or
    // re-create the order manually.
    await paymentRepository.flagForManualReview(
      String(payment._id),
      `Nhận được chuyển khoản ${event.transferAmount}đ sau khi payment đã ở trạng thái ${payment.status} (giao dịch ${event.transactionId})`
    );
    logger.warn(
      { paymentCode: payment.paymentCode, status: payment.status, transactionId: event.transactionId },
      "payment rejected - transfer arrived after payment reached a terminal state (needs manual review)"
    );
    return {
      matchStatus: "rejected",
      note: `Tiền về sau khi payment đã ${payment.status} - cần đối soát thủ công`,
      paymentId: payment._id,
      orderId: order._id,
    };
  }

  // (6) Exact amount only. Underpayment is never accepted; overpayment is not
  // auto-accepted either, because no business rule defines what to do with the
  // surplus — an admin decides.
  if (event.transferAmount !== payment.amount) {
    const direction = event.transferAmount < payment.amount ? "thiếu" : "thừa";
    await paymentRepository.flagForManualReview(
      String(payment._id),
      `Số tiền chuyển khoản ${direction}: nhận ${event.transferAmount}đ, cần ${payment.amount}đ (giao dịch ${event.transactionId})`
    );
    logger.warn(
      { paymentCode: payment.paymentCode, expected: payment.amount, actual: event.transferAmount },
      "payment rejected - wrong amount"
    );
    return {
      matchStatus: "rejected",
      note: `Số tiền không khớp: nhận ${event.transferAmount}đ, cần ${payment.amount}đ`,
      paymentId: payment._id,
      orderId: order._id,
    };
  }

  // (8) Deadline is enforced against the transfer's own timestamp when the bank
  // provides one, so a slow webhook delivery cannot invalidate a timely payment.
  const paidAtBank = event.transactionDate ?? new Date();
  if (paidAtBank.getTime() > (payment.expiresAt as Date).getTime()) {
    await paymentRepository.flagForManualReview(
      String(payment._id),
      `Chuyển khoản lúc ${paidAtBank.toISOString()} sau hạn thanh toán ${(payment.expiresAt as Date).toISOString()} (giao dịch ${event.transactionId})`
    );
    logger.warn(
      { paymentCode: payment.paymentCode, paidAtBank, expiresAt: payment.expiresAt },
      "payment rejected - transfer made after the payment deadline (needs manual review)"
    );
    return {
      matchStatus: "rejected",
      note: "Chuyển khoản sau thời hạn thanh toán - cần đối soát thủ công",
      paymentId: payment._id,
      orderId: order._id,
    };
  }

  const settled = await settlePayment(payment, order, event);
  if (!settled) {
    return {
      matchStatus: "ignored",
      note: "Payment đã được xử lý bởi một webhook khác",
      paymentId: payment._id,
      orderId: order._id,
    };
  }

  return { matchStatus: "matched", note: "", paymentId: payment._id, orderId: order._id };
}

/** Bank memos sometimes pad account numbers; compare on digits only. */
function accountMatches(actual: string, expected: string): boolean {
  const normalize = (value: string) => value.replace(/\D/g, "");
  const a = normalize(actual);
  const b = normalize(expected);
  return a.length > 0 && a === b;
}

/**
 * Customer-facing payment state for an order, used by the storefront's polling.
 *
 * Reads are the natural moment to notice a deadline has passed, so an overdue
 * payment is expired here too — a customer who never pays does not have to wait
 * for the background sweep to see the right state.
 */
export async function getPaymentStatusForCustomer(orderNumber: string, email: string, includeQr = false) {
  const order = (await orderRepository.findByOrderNumber(orderNumber.toUpperCase())) as OrderRecord | null;
  if (!order || order.customer?.email.toLowerCase() !== email.toLowerCase()) {
    throw ApiError.notFound("Không tìm thấy đơn hàng với thông tin đã cung cấp");
  }

  let payment = (await paymentRepository.findByOrderId(String(order._id))) as PaymentRecord | null;
  if (!payment) throw ApiError.notFound("Đơn hàng này không có giao dịch thanh toán");

  if (!isTerminal(payment) && (payment.expiresAt as Date).getTime() <= Date.now()) {
    const expired = await expirePayment(payment);
    payment = ((expired as PaymentRecord | null) ?? (await paymentRepository.findById(String(payment._id)))) as PaymentRecord;
  }

  // Re-read the order: expiry above may have cancelled it.
  const currentOrder = ((await orderRepository.findById(String(order._id))) ?? order) as OrderRecord;

  return {
    order: {
      orderNumber: currentOrder.orderNumber,
      email: currentOrder.customer?.email ?? "",
      total: currentOrder.total,
      currency: currentOrder.currency,
      paymentStatus: currentOrder.paymentStatus,
      orderStatus: currentOrder.orderStatus,
      createdAt: (currentOrder.createdAt as Date).toISOString(),
    },
    payment: await renderPaymentView(payment, includeQr),
  };
}
