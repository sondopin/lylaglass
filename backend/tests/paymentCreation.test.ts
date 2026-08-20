import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractPaymentCodes, generatePaymentCode } from "@/utils/paymentCode";

const SHOP_ACCOUNT = "0338123456789";
const TTL_MINUTES = 15;

vi.mock("@/config/env", () => ({
  env: {
    nodeEnv: "test",
    isProduction: false,
    storefrontUrl: "https://lylaglass.vn",
    // The admin app is its own origin, separate from the storefront (see
    // config/env.ts) — the "new paid order" email links here, not under
    // storefrontUrl/admin/....
    adminUrl: "https://admin.lylaglass.vn",
    payment: {
      provider: "vietqr",
      ttlMinutes: TTL_MINUTES,
      expirySweepIntervalMs: 60_000,
      vietqr: {
        bankBin: "970423",
        bankCode: "TPB",
        bankName: "TPBank",
        accountNumber: SHOP_ACCOUNT,
        accountName: "NGUYEN VAN SON",
      },
      bankWebhook: { provider: "sepay", authMode: "hmac", secret: "s", apiKey: "", timestampToleranceSeconds: 300 },
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
  create: vi.fn(),
  findById: vi.fn(),
  findByOrderId: vi.fn(),
  findByPaymentCode: vi.fn(),
  markSucceeded: vi.fn(),
  markClosed: vi.fn(),
  flagForManualReview: vi.fn(),
  claimEmailSend: vi.fn(),
  markEmailSent: vi.fn(),
  markEmailSkipped: vi.fn(),
  markEmailFailed: vi.fn(),
  findExpiredOpen: vi.fn(),
  findEmailRetryable: vi.fn(),
  updateById: vi.fn(),
}));

vi.mock("@/repositories/payment.repository", () => ({ paymentRepository }));
vi.mock("@/repositories/order.repository", () => ({ orderRepository: {} }));
vi.mock("@/repositories/bankTransaction.repository", () => ({ bankTransactionRepository: {} }));
vi.mock("@/repositories/product.repository", () => ({ productRepository: {} }));
vi.mock("@/repositories/coupon.repository", () => ({ couponRepository: {} }));

const { createPaymentForOrder, toPublicPaymentView } = await import("@/services/payment.service");
const { buildPaymentConfirmationEmail, buildNewOrderNotificationEmail } = await import("@/services/email.service");

const ORDER = {
  _id: new Types.ObjectId(),
  orderNumber: "LG20260817-K7M2XQ",
  total: 329000,
  currency: "VND",
  customer: { name: "Nguyen Van A", email: "customer@example.com", phone: "0900000000" },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Echo back whatever the service asked to persist.
  paymentRepository.create.mockImplementation(async (data: Record<string, unknown>) => ({
    ...data,
    _id: new Types.ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    toObject() {
      return { ...this };
    },
  }));
});

describe("checkout payment creation", () => {
  it("creates an unpaid payment awaiting a bank transfer", async () => {
    const { payment } = await createPaymentForOrder(ORDER);

    expect(payment.provider).toBe("vietqr");
    expect(payment.method).toBe("bank_transfer");
    // Crucially NOT succeeded — no money has moved just because a QR exists.
    expect(payment.status).toBe("requires_action");
    expect(payment.amount).toBe(329000);
    expect(payment.paidAt).toBeUndefined();
    expect(payment.transactionId).toBeUndefined();
  });

  it("stores the shop's TPBank account, never a client-supplied one", async () => {
    const { payment } = await createPaymentForOrder(ORDER);

    expect(payment.bankBin).toBe("970423");
    expect(payment.bankName).toBe("TPBank");
    expect(payment.bankAccountNumber).toBe(SHOP_ACCOUNT);
    expect(payment.bankAccountName).toBe("NGUYEN VAN SON");
  });

  it("derives the deadline from server time, not from the client", async () => {
    const before = Date.now();
    const { payment } = await createPaymentForOrder(ORDER);
    const after = Date.now();

    const expiresAt = (payment.expiresAt as Date).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + TTL_MINUTES * 60_000);
    expect(expiresAt).toBeLessThanOrEqual(after + TTL_MINUTES * 60_000);
  });

  it("encodes the exact order total and the payment code into the QR", async () => {
    const { payment, qrCodeDataUrl } = await createPaymentForOrder(ORDER);

    expect(payment.qrPayload).toContain("5406329000"); // tag 54, amount 329000
    // tag 62 (additional data), length 12 -> sub-tag 08 (purpose), length 08
    expect(payment.qrPayload).toContain(`62120808${payment.paymentCode}`);
    expect(payment.qrPayload).toContain("0006970423"); // TPBank BIN
    expect(payment.qrPayload).toContain(`0113${SHOP_ACCOUNT}`);
    expect(qrCodeDataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("gives every payment a unique code that doubles as its intent id", async () => {
    const first = await createPaymentForOrder(ORDER);
    const second = await createPaymentForOrder(ORDER);

    expect(first.payment.paymentCode).not.toBe(second.payment.paymentCode);
    expect(first.payment.intentId).toBe(first.payment.paymentCode);
    expect(first.payment.paymentCode).toMatch(/^LG[2-9A-HJ-NP-Z]{6}$/);
  });

  it("never exposes internal reconciliation data to the storefront", async () => {
    const { payment } = await createPaymentForOrder(ORDER);
    const view = toPublicPaymentView({
      ...payment,
      rawEvent: { secret: "provider internals" },
      needsManualReview: true,
      manualReviewReason: "internal note",
      confirmationEmailStatus: "pending",
    } as never);

    expect(Object.keys(view)).not.toContain("rawEvent");
    expect(Object.keys(view)).not.toContain("needsManualReview");
    expect(Object.keys(view)).not.toContain("confirmationEmailStatus");
    expect(JSON.stringify(view)).not.toContain("provider internals");
  });
});

describe("payment code extraction", () => {
  it("finds the code however the bank formats the memo", () => {
    expect(extractPaymentCodes("LG8K3F2A")).toEqual(["LG8K3F2A"]);
    expect(extractPaymentCodes("", "CT DEN:123 LG8K3F2A THANH TOAN")).toEqual(["LG8K3F2A"]);
    expect(extractPaymentCodes("", "lg8k3f2a chuyen tien")).toEqual(["LG8K3F2A"]);
  });

  it("does not mistake an order number for a payment code", () => {
    // Order numbers contain 0/1, which the payment-code alphabet excludes.
    expect(extractPaymentCodes("", "thanh toan LG20260817-K7M2XQ")).toEqual([]);
  });

  it("returns nothing for a memo with no code", () => {
    expect(extractPaymentCodes("", "chuyen tien mua ly thuy tinh", "")).toEqual([]);
  });

  it("generates codes from a confusable-free alphabet", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePaymentCode()).toMatch(/^LG[2-9A-HJ-NP-Z]{6}$/);
    }
  });
});

describe("payment confirmation email", () => {
  const paidPayment = {
    _id: new Types.ObjectId(),
    paymentCode: "LG8K3F2A",
    bankName: "TPBank",
    paidAt: new Date("2026-08-17T12:10:00.000Z"),
    amount: 329000,
  };

  const paidOrder = {
    orderNumber: "LG20260817-K7M2XQ",
    customer: { name: "Nguyen Van A", email: "customer@example.com", phone: "0900000000" },
    shippingAddress: { fullName: "Nguyen Van A", phone: "0900000000", line1: "12 Le Loi", province: "Hà Nội" },
    items: [{ productName: "Ly thuỷ tinh Lyla", variantName: "350ml", quantity: 2, lineTotal: 300000 }],
    subtotal: 300000,
    shippingFee: 29000,
    discountTotal: 0,
    couponCode: "",
    total: 329000,
    createdAt: new Date("2026-08-17T12:00:00.000Z"),
  };

  it("states the payment succeeded and identifies the order", () => {
    const email = buildPaymentConfirmationEmail(paidOrder as never, paidPayment as never);

    expect(email.subject).toContain("Thanh toán thành công");
    expect(email.subject).toContain("LG20260817-K7M2XQ");
    expect(email.text).toContain("Thanh toán thành công");
    expect(email.text).toContain("Mã đơn hàng: LG20260817-K7M2XQ");
    expect(email.text).toContain("329.000đ");
    expect(email.text).toContain("Chuyển khoản ngân hàng qua VietQR / TPBank");
    expect(email.text).toContain("Đơn hàng của bạn đã được xác nhận.");
    expect(email.text).toContain("Ly thuỷ tinh Lyla");
    expect(email.text).toContain("https://lylaglass.vn/orders/LG20260817-K7M2XQ");
  });

  it("escapes customer-supplied text in the HTML body", () => {
    const email = buildPaymentConfirmationEmail(
      { ...paidOrder, shippingAddress: { ...paidOrder.shippingAddress, fullName: '<script>alert("x")</script>' } } as never,
      paidPayment as never
    );

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("shop owner notification email", () => {
  const paidPayment = {
    _id: new Types.ObjectId(),
    paymentCode: "LG8K3F2A",
    bankName: "TPBank",
    paidAt: new Date("2026-08-17T12:10:00.000Z"),
    amount: 329000,
    transferredAmount: 329000,
    transactionId: "92704",
    referenceCode: "FT26012345678",
  };

  const paidOrder = {
    _id: new Types.ObjectId(),
    orderNumber: "LG20260817-K7M2XQ",
    customer: { name: "Nguyen Van A", email: "customer@example.com", phone: "0900000000" },
    shippingAddress: { fullName: "Nguyen Van A", phone: "0900000000", line1: "12 Le Loi", province: "Hà Nội" },
    items: [{ productName: "Ly thuỷ tinh Lyla", variantName: "350ml", sku: "LY-350", quantity: 2, lineTotal: 300000 }],
    subtotal: 300000,
    shippingFee: 29000,
    discountTotal: 0,
    couponCode: "",
    customerNote: "",
    total: 329000,
    createdAt: new Date("2026-08-17T12:00:00.000Z"),
  };

  it("leads with what the shop must act on", () => {
    const email = buildNewOrderNotificationEmail(paidOrder as never, paidPayment as never);

    // Subject is scannable in a notification: order number + amount.
    expect(email.subject).toContain("LG20260817-K7M2XQ");
    expect(email.subject).toContain("329.000đ");
    expect(email.text).toContain("ĐƠN MỚI ĐÃ THANH TOÁN");
    // What to pack, including SKU.
    expect(email.text).toContain("LY-350");
    expect(email.text).toContain("× 2");
    // Where to ship it.
    expect(email.text).toContain("12 Le Loi");
    expect(email.text).toContain("0900000000");
    // Reconciliation data.
    expect(email.text).toContain("92704");
    expect(email.text).toContain("FT26012345678");
    // Straight into the admin app's own screen for this order (its own
    // origin now, so no `/admin` prefix).
    expect(email.text).toContain(`https://admin.lylaglass.vn/orders/${String(paidOrder._id)}`);
  });

  it("surfaces the customer note and a manual-review warning when present", () => {
    const email = buildNewOrderNotificationEmail(
      { ...paidOrder, customerNote: "Giao giờ hành chính" } as never,
      { ...paidPayment, needsManualReview: true, manualReviewReason: "Chuyển thừa 50.000đ" } as never
    );

    expect(email.text).toContain("Giao giờ hành chính");
    expect(email.text).toContain("CẦN ĐỐI SOÁT THỦ CÔNG");
    expect(email.text).toContain("Chuyển thừa 50.000đ");
    expect(email.html).toContain("Cần đối soát thủ công");
  });

  it("escapes shop-facing HTML too — customer data is untrusted here as well", () => {
    const email = buildNewOrderNotificationEmail(
      { ...paidOrder, customerNote: '<img src=x onerror="alert(1)">' } as never,
      paidPayment as never
    );

    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img src=x");
  });
});
