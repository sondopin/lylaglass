import crypto from "node:crypto";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reconciliation behaviour is verified against stubbed repositories rather than a
 * real MongoDB: the rules under test are decisions ("may this transfer mark the
 * payment paid?"), and stubs make each rule's failure mode explicit.
 *
 * The stubs still model the two things the real database guarantees:
 *  - `insertIfNew` returns null for an already-seen transaction id (unique index)
 *  - `markSucceeded` / `markClosed` only transition a payment that is still open
 *    (conditional atomic update)
 */

const SECRET = "test-webhook-secret";
const SHOP_ACCOUNT = "0338123456789";
const PAYMENT_CODE = "LG8K3F2A";
const ORDER_TOTAL = 329000;

vi.mock("@/config/env", () => ({
  env: {
    nodeEnv: "test",
    isProduction: false,
    storefrontUrl: "http://localhost:3000",
    payment: {
      provider: "vietqr",
      ttlMinutes: 15,
      expirySweepIntervalMs: 60_000,
      vietqr: {
        bankBin: "970423",
        bankCode: "TPB",
        bankName: "TPBank",
        accountNumber: SHOP_ACCOUNT,
        accountName: "LYLAGLASS",
      },
      bankWebhook: {
        provider: "sepay",
        authMode: "hmac",
        secret: SECRET,
        apiKey: "",
        timestampToleranceSeconds: 300,
      },
    },
    email: {
      provider: "log",
      apiKey: "",
      from: "test@lylaglass.vn",
      replyTo: "",
      maxAttempts: 3,
      orderNotificationRecipients: ["shop@lylaglass.vn"],
    },
  },
}));

vi.mock("@/config/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const paymentRepository = vi.hoisted(() => ({
  findByPaymentCode: vi.fn(),
  findById: vi.fn(),
  findByOrderId: vi.fn(),
  markSucceeded: vi.fn(),
  markClosed: vi.fn(),
  flagForManualReview: vi.fn(),
  claimEmailSend: vi.fn(),
  markEmailSent: vi.fn(),
  markEmailSkipped: vi.fn(),
  markEmailFailed: vi.fn(),
  findExpiredOpen: vi.fn(),
  findEmailRetryable: vi.fn(),
  create: vi.fn(),
  updateById: vi.fn(),
}));

const orderRepository = vi.hoisted(() => ({
  findById: vi.fn(),
  findByOrderNumber: vi.fn(),
  updateById: vi.fn(),
  claimInventoryRelease: vi.fn(),
  claimCouponUsageRelease: vi.fn(),
}));

const bankTransactionRepository = vi.hoisted(() => ({
  insertIfNew: vi.fn(),
  updateById: vi.fn(),
}));

const productRepository = vi.hoisted(() => ({
  restockVariant: vi.fn(),
}));

const couponRepository = vi.hoisted(() => ({
  findByCode: vi.fn(),
  decrementUsage: vi.fn(),
}));

const sendPaymentConfirmationEmail = vi.hoisted(() => vi.fn());
const sendNewOrderNotificationEmail = vi.hoisted(() => vi.fn());

vi.mock("@/repositories/payment.repository", () => ({ paymentRepository }));
vi.mock("@/repositories/order.repository", () => ({ orderRepository }));
vi.mock("@/repositories/bankTransaction.repository", () => ({ bankTransactionRepository }));
vi.mock("@/repositories/product.repository", () => ({ productRepository }));
vi.mock("@/repositories/coupon.repository", () => ({ couponRepository }));
vi.mock("@/services/email.service", () => ({ sendPaymentConfirmationEmail, sendNewOrderNotificationEmail }));

const { handleBankWebhook, expireOverduePayments, expirePayment } = await import("@/services/payment.service");

type StubPayment = Record<string, unknown> & { _id: Types.ObjectId; status: string };

function makePayment(overrides: Partial<StubPayment> = {}): StubPayment {
  return {
    _id: new Types.ObjectId(),
    orderId: new Types.ObjectId(),
    provider: "vietqr",
    method: "bank_transfer",
    status: "requires_action",
    amount: ORDER_TOTAL,
    currency: "VND",
    paymentCode: PAYMENT_CODE,
    bankAccountNumber: SHOP_ACCOUNT,
    bankName: "TPBank",
    expiresAt: new Date(Date.now() + 10 * 60_000),
    confirmationEmailStatus: "pending",
    confirmationEmailAttempts: 0,
    ...overrides,
  };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    orderNumber: "LG20260817-K7M2XQ",
    customer: { name: "Nguyen Van A", email: "customer@example.com", phone: "0900000000" },
    total: ORDER_TOTAL,
    currency: "VND",
    paymentStatus: "pending",
    orderStatus: "pending",
    couponCode: "",
    inventoryReleased: false,
    couponUsageReleased: false,
    items: [{ productId: new Types.ObjectId(), sku: "SKU-1", quantity: 2 }],
    createdAt: new Date(),
    ...overrides,
  };
}

function webhookRequest(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload));
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac("sha256", SECRET).update(`${timestamp}.${body.toString("utf-8")}`).digest("hex");
  return {
    body,
    headers: { "x-sepay-signature": `sha256=${signature}`, "x-sepay-timestamp": String(timestamp) },
  };
}

function transferPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 92704,
    gateway: "TPBank",
    transactionDate: "2026-08-17 19:05:12",
    accountNumber: SHOP_ACCOUNT,
    subAccount: "",
    code: PAYMENT_CODE,
    content: `${PAYMENT_CODE} chuyen tien`,
    transferType: "in",
    description: "",
    transferAmount: ORDER_TOTAL,
    accumulated: 1_000_000,
    referenceCode: "FT26012345678",
    ...overrides,
  };
}

/** Wires the happy-path stubs: one open payment, one pending order. */
function arrangeOpenPayment(paymentOverrides: Partial<StubPayment> = {}, orderOverrides: Record<string, unknown> = {}) {
  const order = makeOrder(orderOverrides);
  const payment = makePayment({ orderId: order._id, ...paymentOverrides });

  bankTransactionRepository.insertIfNew.mockResolvedValue({ _id: new Types.ObjectId() });
  bankTransactionRepository.updateById.mockResolvedValue({});
  paymentRepository.findByPaymentCode.mockImplementation(async (code: string) =>
    code === payment.paymentCode ? payment : null
  );
  orderRepository.findById.mockResolvedValue(order);
  orderRepository.updateById.mockResolvedValue(order);
  paymentRepository.markSucceeded.mockImplementation(async () =>
    ["succeeded", "failed", "expired", "refunded"].includes(payment.status)
      ? null
      : { ...payment, status: "succeeded", paidAt: new Date() }
  );
  paymentRepository.claimEmailSend.mockResolvedValue({ ...payment, confirmationEmailStatus: "sending" });
  paymentRepository.markEmailSent.mockResolvedValue({});
  paymentRepository.flagForManualReview.mockResolvedValue({});
  sendPaymentConfirmationEmail.mockResolvedValue({ id: "email_1" });
  sendNewOrderNotificationEmail.mockResolvedValue({ id: "email_owner_1" });

  return { order, payment };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bank webhook — a valid transfer settles the order", () => {
  it("marks the payment paid, confirms the order and sends exactly one email", async () => {
    const { order } = arrangeOpenPayment();
    const { body, headers } = webhookRequest(transferPayload());

    const result = await handleBankWebhook(body, headers);

    expect(result).toMatchObject({ processed: true, duplicate: false, status: "matched" });
    expect(paymentRepository.markSucceeded).toHaveBeenCalledTimes(1);
    expect(paymentRepository.markSucceeded.mock.calls[0][1]).toMatchObject({
      transactionId: "92704",
      referenceCode: "FT26012345678",
      transferredAmount: ORDER_TOTAL,
    });
    expect(orderRepository.updateById).toHaveBeenCalledWith(String(order._id), {
      paymentStatus: "paid",
      orderStatus: "confirmed",
    });
    expect(sendPaymentConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  it("never returns reserved inventory for a successful payment", async () => {
    arrangeOpenPayment();
    const { body, headers } = webhookRequest(transferPayload());

    await handleBankWebhook(body, headers);

    expect(productRepository.restockVariant).not.toHaveBeenCalled();
    expect(orderRepository.claimInventoryRelease).not.toHaveBeenCalled();
  });

  it("matches on the payment code found in the memo, not on the amount", async () => {
    arrangeOpenPayment();
    // No pre-extracted `code` — only the raw transfer memo carries it.
    const { body, headers } = webhookRequest(transferPayload({ code: "", content: `chuyen tien ${PAYMENT_CODE}` }));

    const result = await handleBankWebhook(body, headers);

    expect(result.status).toBe("matched");
    expect(paymentRepository.findByPaymentCode).toHaveBeenCalledWith(PAYMENT_CODE);
  });
});

describe("bank webhook — transfers that must not settle the order", () => {
  it("does not mark paid when the amount is short", async () => {
    const { payment } = arrangeOpenPayment();
    const { body, headers } = webhookRequest(transferPayload({ transferAmount: 300000 }));

    const result = await handleBankWebhook(body, headers);

    expect(result).toMatchObject({ processed: false, status: "rejected" });
    expect(paymentRepository.markSucceeded).not.toHaveBeenCalled();
    expect(sendPaymentConfirmationEmail).not.toHaveBeenCalled();
    // Flagged so an admin can deal with the real money that arrived.
    expect(paymentRepository.flagForManualReview).toHaveBeenCalledWith(
      String(payment._id),
      expect.stringContaining("thiếu")
    );
  });

  it("does not mark paid when the customer overpays", async () => {
    const { payment } = arrangeOpenPayment();
    const { body, headers } = webhookRequest(transferPayload({ transferAmount: 400000 }));

    const result = await handleBankWebhook(body, headers);

    expect(result.status).toBe("rejected");
    expect(paymentRepository.markSucceeded).not.toHaveBeenCalled();
    expect(paymentRepository.flagForManualReview).toHaveBeenCalledWith(
      String(payment._id),
      expect.stringContaining("thừa")
    );
  });

  it("does not mark paid when the memo carries no known payment code", async () => {
    arrangeOpenPayment();
    const { body, headers } = webhookRequest(transferPayload({ code: "", content: "tien mua ly thuy tinh" }));

    const result = await handleBankWebhook(body, headers);

    expect(result).toMatchObject({ processed: false, status: "unmatched" });
    expect(paymentRepository.markSucceeded).not.toHaveBeenCalled();
    expect(sendPaymentConfirmationEmail).not.toHaveBeenCalled();
  });

  it("does not mark paid when the payment code belongs to no payment", async () => {
    arrangeOpenPayment();
    const { body, headers } = webhookRequest(transferPayload({ code: "LGZZZZZZ", content: "LGZZZZZZ" }));

    const result = await handleBankWebhook(body, headers);

    expect(result.status).toBe("unmatched");
    expect(paymentRepository.markSucceeded).not.toHaveBeenCalled();
  });

  it("does not mark paid when the money landed in a different bank account", async () => {
    arrangeOpenPayment();
    const { body, headers } = webhookRequest(transferPayload({ accountNumber: "9999999999" }));

    const result = await handleBankWebhook(body, headers);

    expect(result).toMatchObject({ processed: false, status: "rejected" });
    expect(paymentRepository.findByPaymentCode).not.toHaveBeenCalled();
    expect(paymentRepository.markSucceeded).not.toHaveBeenCalled();
  });

  it("ignores outgoing transfers", async () => {
    arrangeOpenPayment();
    const { body, headers } = webhookRequest(transferPayload({ transferType: "out" }));

    const result = await handleBankWebhook(body, headers);

    expect(result.status).toBe("ignored");
    expect(paymentRepository.markSucceeded).not.toHaveBeenCalled();
  });

  it("does not mark paid when the transfer was made after the deadline", async () => {
    const { payment } = arrangeOpenPayment({ expiresAt: new Date("2026-08-17T11:00:00.000Z") });
    // 19:05 Vietnam time = 12:05 UTC, i.e. after the 11:00 UTC deadline.
    const { body, headers } = webhookRequest(transferPayload());

    const result = await handleBankWebhook(body, headers);

    expect(result.status).toBe("rejected");
    expect(paymentRepository.markSucceeded).not.toHaveBeenCalled();
    expect(paymentRepository.flagForManualReview).toHaveBeenCalledWith(
      String(payment._id),
      expect.stringContaining("sau hạn thanh toán")
    );
  });

  it("does not resurrect an already expired payment", async () => {
    const { payment } = arrangeOpenPayment({ status: "expired" });
    const { body, headers } = webhookRequest(transferPayload());

    const result = await handleBankWebhook(body, headers);

    expect(result.status).toBe("rejected");
    expect(paymentRepository.markSucceeded).not.toHaveBeenCalled();
    expect(paymentRepository.flagForManualReview).toHaveBeenCalledWith(
      String(payment._id),
      expect.stringContaining("expired")
    );
  });

  it("rejects a webhook whose signature does not verify", async () => {
    arrangeOpenPayment();
    const body = Buffer.from(JSON.stringify(transferPayload()));

    await expect(
      handleBankWebhook(body, { "x-sepay-signature": "sha256=deadbeef", "x-sepay-timestamp": "1" })
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(bankTransactionRepository.insertIfNew).not.toHaveBeenCalled();
  });
});

describe("shop owner notification", () => {
  it("alerts the shop once when a payment succeeds", async () => {
    const { order } = arrangeOpenPayment();
    const { body, headers } = webhookRequest(transferPayload());

    await handleBankWebhook(body, headers);

    expect(sendNewOrderNotificationEmail).toHaveBeenCalledTimes(1);
    // Same order/payment data as the customer email, different template.
    expect(sendNewOrderNotificationEmail.mock.calls[0][0]).toMatchObject({ orderNumber: order.orderNumber });
    expect(paymentRepository.markEmailSent).toHaveBeenCalledWith(expect.any(String), "ownerNotification");
  });

  it("is not sent for a transfer that was rejected", async () => {
    arrangeOpenPayment();
    const { body, headers } = webhookRequest(transferPayload({ transferAmount: 1000 }));

    await handleBankWebhook(body, headers);

    expect(sendNewOrderNotificationEmail).not.toHaveBeenCalled();
    expect(sendPaymentConfirmationEmail).not.toHaveBeenCalled();
  });

  it("is not sent twice when the provider retries the webhook", async () => {
    arrangeOpenPayment();
    const { body, headers } = webhookRequest(transferPayload());

    await handleBankWebhook(body, headers);
    bankTransactionRepository.insertIfNew.mockResolvedValue(null);
    await handleBankWebhook(body, headers);
    await handleBankWebhook(body, headers);

    expect(sendNewOrderNotificationEmail).toHaveBeenCalledTimes(1);
  });

  it("keeps the payment paid and still emails the customer when the shop alert fails", async () => {
    const { order } = arrangeOpenPayment();
    sendNewOrderNotificationEmail.mockRejectedValue(new Error("smtp down"));
    const { body, headers } = webhookRequest(transferPayload());

    const result = await handleBankWebhook(body, headers);

    expect(result).toMatchObject({ processed: true, status: "matched" });
    // The customer is unaffected by the shop alert failing.
    expect(sendPaymentConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(paymentRepository.markEmailFailed).toHaveBeenCalledWith(
      expect.any(String),
      "ownerNotification",
      expect.stringContaining("smtp down")
    );
    expect(orderRepository.updateById).toHaveBeenCalledWith(String(order._id), {
      paymentStatus: "paid",
      orderStatus: "confirmed",
    });
  });

  it("records a skip instead of sending when no recipient is configured", async () => {
    const { env } = await import("@/config/env");
    const configured = [...env.email.orderNotificationRecipients];
    env.email.orderNotificationRecipients.length = 0; // simulate ORDER_NOTIFICATION_EMAILS=""

    try {
      arrangeOpenPayment();
      const { body, headers } = webhookRequest(transferPayload());

      const result = await handleBankWebhook(body, headers);

      expect(result).toMatchObject({ processed: true, status: "matched" });
      expect(sendNewOrderNotificationEmail).not.toHaveBeenCalled();
      // Marked once so the retry sweep stops reconsidering it.
      expect(paymentRepository.markEmailSkipped).toHaveBeenCalledWith(
        expect.any(String),
        "ownerNotification",
        expect.any(String)
      );
      // The customer confirmation is unaffected by the alert being disabled.
      expect(sendPaymentConfirmationEmail).toHaveBeenCalledTimes(1);
    } finally {
      env.email.orderNotificationRecipients.push(...configured);
    }
  });

  it("keeps the shop alert independent when the customer email fails", async () => {
    arrangeOpenPayment();
    sendPaymentConfirmationEmail.mockRejectedValue(new Error("mailbox full"));
    const { body, headers } = webhookRequest(transferPayload());

    await handleBankWebhook(body, headers);

    expect(paymentRepository.markEmailFailed).toHaveBeenCalledWith(
      expect.any(String),
      "confirmationEmail",
      expect.stringContaining("mailbox full")
    );
    expect(sendNewOrderNotificationEmail).toHaveBeenCalledTimes(1);
    expect(paymentRepository.markEmailSent).toHaveBeenCalledWith(expect.any(String), "ownerNotification");
  });
});

describe("bank webhook — idempotency", () => {
  it("processes a replayed delivery of the same transaction only once", async () => {
    arrangeOpenPayment();
    const { body, headers } = webhookRequest(transferPayload());

    const first = await handleBankWebhook(body, headers);
    expect(first).toMatchObject({ processed: true, duplicate: false });

    // Second and third deliveries: the unique index rejects the insert.
    bankTransactionRepository.insertIfNew.mockResolvedValue(null);
    const second = await handleBankWebhook(body, headers);
    const third = await handleBankWebhook(body, headers);

    expect(second).toMatchObject({ processed: false, duplicate: true });
    expect(third).toMatchObject({ processed: false, duplicate: true });
    expect(paymentRepository.markSucceeded).toHaveBeenCalledTimes(1);
    expect(orderRepository.updateById).toHaveBeenCalledTimes(1);
    expect(sendPaymentConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  it("sends no second email when a different transaction hits an already paid payment", async () => {
    arrangeOpenPayment({ status: "succeeded" });
    const { body, headers } = webhookRequest(transferPayload({ id: 92705 }));

    const result = await handleBankWebhook(body, headers);

    expect(result.status).toBe("ignored");
    expect(sendPaymentConfirmationEmail).not.toHaveBeenCalled();
    expect(orderRepository.updateById).not.toHaveBeenCalled();
  });

  it("sends no email when the confirmation email was already claimed", async () => {
    arrangeOpenPayment();
    // A concurrent worker already claimed the send.
    paymentRepository.claimEmailSend.mockResolvedValue(null);
    const { body, headers } = webhookRequest(transferPayload());

    await handleBankWebhook(body, headers);

    expect(paymentRepository.markSucceeded).toHaveBeenCalledTimes(1);
    expect(sendPaymentConfirmationEmail).not.toHaveBeenCalled();
  });

  it("keeps the payment paid when the email provider fails", async () => {
    arrangeOpenPayment();
    sendPaymentConfirmationEmail.mockRejectedValue(new Error("provider down"));
    const { body, headers } = webhookRequest(transferPayload());

    const result = await handleBankWebhook(body, headers);

    expect(result).toMatchObject({ processed: true, status: "matched" });
    expect(paymentRepository.markSucceeded).toHaveBeenCalledTimes(1);
    expect(paymentRepository.markEmailFailed).toHaveBeenCalled();
    // The order stays confirmed — a failed email never rolls payment back.
    expect(orderRepository.updateById).toHaveBeenCalledWith(expect.any(String), {
      paymentStatus: "paid",
      orderStatus: "confirmed",
    });
  });
});

describe("payment expiry", () => {
  function arrangeExpiry(order: Record<string, unknown>, payment: StubPayment) {
    let released = false;
    let couponReleased = false;

    paymentRepository.markClosed.mockImplementation(async () =>
      ["succeeded", "failed", "expired", "refunded"].includes(payment.status)
        ? null
        : { ...payment, status: "expired" }
    );
    orderRepository.findById.mockResolvedValue(order);
    orderRepository.updateById.mockResolvedValue(order);
    orderRepository.claimInventoryRelease.mockImplementation(async () => {
      if (released) return null;
      released = true;
      return order;
    });
    orderRepository.claimCouponUsageRelease.mockImplementation(async () => {
      if (couponReleased || !order.couponCode) return null;
      couponReleased = true;
      return order;
    });
    productRepository.restockVariant.mockResolvedValue({});
    couponRepository.findByCode.mockResolvedValue({ _id: new Types.ObjectId(), code: order.couponCode });
    couponRepository.decrementUsage.mockResolvedValue({});
  }

  it("cancels the order and returns inventory when the deadline passes", async () => {
    const order = makeOrder();
    const payment = makePayment({ orderId: order._id, expiresAt: new Date(Date.now() - 60_000) });
    arrangeExpiry(order, payment);
    paymentRepository.findExpiredOpen.mockResolvedValue([payment]);

    const result = await expireOverduePayments();

    expect(result).toMatchObject({ scanned: 1, expired: 1 });
    expect(orderRepository.updateById).toHaveBeenCalledWith(String(order._id), {
      paymentStatus: "failed",
      orderStatus: "cancelled",
    });
    expect(productRepository.restockVariant).toHaveBeenCalledTimes(order.items.length);
    expect(productRepository.restockVariant).toHaveBeenCalledWith(order.items[0].productId, "SKU-1", 2);
  });

  it("gives back the coupon use that checkout charged", async () => {
    const order = makeOrder({ couponCode: "SALE10" });
    const payment = makePayment({ orderId: order._id, expiresAt: new Date(Date.now() - 60_000) });
    arrangeExpiry(order, payment);

    await expirePayment(payment as never);

    expect(couponRepository.decrementUsage).toHaveBeenCalledTimes(1);
  });

  it("never releases inventory twice, however often expiry runs", async () => {
    const order = makeOrder();
    const payment = makePayment({ orderId: order._id, expiresAt: new Date(Date.now() - 60_000) });
    arrangeExpiry(order, payment);

    await expirePayment(payment as never);
    // A second sweep: the payment is now terminal, so markClosed refuses it.
    payment.status = "expired";
    const second = await expirePayment(payment as never);

    expect(second).toBeNull();
    expect(productRepository.restockVariant).toHaveBeenCalledTimes(order.items.length);
  });

  it("refuses to expire a payment that was already paid", async () => {
    const order = makeOrder({ paymentStatus: "paid", orderStatus: "confirmed" });
    const payment = makePayment({ orderId: order._id, status: "succeeded" });
    arrangeExpiry(order, payment);

    const result = await expirePayment(payment as never);

    expect(result).toBeNull();
    expect(productRepository.restockVariant).not.toHaveBeenCalled();
    expect(orderRepository.updateById).not.toHaveBeenCalled();
  });
});
