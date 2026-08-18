import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Checkout's safety properties, verified against stubbed repositories.
 *
 * What these tests pin down is not "an order gets created" but the four ways
 * checkout can be attacked or lose a race:
 *   - a tampered cart trying to set its own prices
 *   - two buyers racing for the last unit of a SKU
 *   - two buyers racing for the last use of a coupon
 *   - a cart naming the same SKU twice to slip past the stock check
 */

const ORDER_ID = new Types.ObjectId();
const PRODUCT_ID = new Types.ObjectId();
const COUPON_ID = new Types.ObjectId();

vi.mock("@/config/env", () => ({
  env: {
    nodeEnv: "test",
    isProduction: false,
    storefrontUrl: "http://localhost:3000",
    payment: {
      provider: "vietqr",
      ttlMinutes: 15,
      vietqr: {
        bankBin: "970423",
        bankCode: "TPB",
        bankName: "TPBank",
        accountNumber: "0338123456789",
        accountName: "LYLAGLASS",
      },
      bankWebhook: { provider: "sepay", authMode: "hmac", secret: "s", apiKey: "", timestampToleranceSeconds: 300 },
    },
    email: { provider: "log", from: "", replyTo: "", maxAttempts: 3, orderNotificationRecipients: [] },
  },
}));

vi.mock("@/config/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const SESSION = vi.hoisted(() => ({ id: "test-session" }) as unknown as import("mongoose").ClientSession);

vi.mock("@/config/db", () => ({
  supportsTransactions: () => true,
  withTransaction: vi.fn(async (fn: (session?: unknown) => Promise<unknown>) => fn(SESSION)),
}));

const productRepository = vi.hoisted(() => ({
  findById: vi.fn(),
  decrementVariantStock: vi.fn(),
  restockVariant: vi.fn(),
}));

const orderRepository = vi.hoisted(() => ({
  create: vi.fn(),
  updateById: vi.fn(),
  findById: vi.fn(),
  claimInventoryRelease: vi.fn(),
  claimCouponUsageRelease: vi.fn(),
}));

const couponRepository = vi.hoisted(() => ({
  findByCode: vi.fn(),
  claimUsage: vi.fn(),
  decrementUsage: vi.fn(),
}));

const customerRepository = vi.hoisted(() => ({ upsertFromOrder: vi.fn() }));
const settingsRepository = vi.hoisted(() => ({ read: vi.fn(), get: vi.fn() }));
const buildPaymentForOrder = vi.hoisted(() => vi.fn());
const renderPaymentView = vi.hoisted(() => vi.fn());

vi.mock("@/repositories/product.repository", () => ({ productRepository }));
vi.mock("@/repositories/order.repository", () => ({ orderRepository }));
vi.mock("@/repositories/coupon.repository", () => ({ couponRepository }));
vi.mock("@/repositories/customer.repository", () => ({ customerRepository }));
vi.mock("@/repositories/settings.repository", () => ({ settingsRepository }));
vi.mock("@/services/payment.service", () => ({ buildPaymentForOrder, renderPaymentView }));

const { processCheckout } = await import("@/services/checkout.service");

const PRODUCT = {
  _id: PRODUCT_ID,
  name: "Ly thủy tinh Aurora",
  slug: "ly-thuy-tinh-aurora",
  status: "active",
  images: [{ url: "https://cdn.test/aurora.jpg" }],
  variants: [
    { sku: "AUR-300", name: "300ml", price: 189_000, inventoryQty: 5, attributes: {} },
    { sku: "AUR-500", name: "500ml", price: 229_000, inventoryQty: 2, attributes: {} },
  ],
};

function checkoutInput(overrides: Record<string, unknown> = {}) {
  return {
    customer: { name: "Nguyễn Văn A", email: "customer@example.com", phone: "0900000000" },
    shippingAddress: {
      fullName: "Nguyễn Văn A",
      phone: "0900000000",
      line1: "12 Nguyễn Huệ",
      province: "TP. Hồ Chí Minh",
    },
    items: [{ productId: String(PRODUCT_ID), sku: "AUR-300", quantity: 2 }],
    paymentMethod: "bank_transfer",
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();

  productRepository.findById.mockResolvedValue(PRODUCT);
  productRepository.decrementVariantStock.mockResolvedValue(PRODUCT);
  settingsRepository.read.mockResolvedValue({ freeShippingThreshold: 490_000, flatShippingFee: 30_000 });
  orderRepository.create.mockImplementation(async (data: Record<string, unknown>) => ({
    _id: ORDER_ID,
    toObject: () => ({ _id: ORDER_ID, ...data }),
  }));
  orderRepository.updateById.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
    _id: ORDER_ID,
    orderNumber: "LG20260818-ABC123",
    total: 408_000,
    ...patch,
  }));
  buildPaymentForOrder.mockResolvedValue({ _id: new Types.ObjectId(), qrPayload: "000201...", amount: 408_000 });
  renderPaymentView.mockResolvedValue({ qrCodeDataUrl: "data:image/png;base64,AAAA" });
  customerRepository.upsertFromOrder.mockResolvedValue({});
});

describe("pricing is server-authoritative", () => {
  it("prices every line from the product document, ignoring anything the client sent", async () => {
    // A tampered cart claiming a 1.000đ unit price for a 189.000đ variant.
    await processCheckout(checkoutInput({ items: [{ productId: String(PRODUCT_ID), sku: "AUR-300", quantity: 2, unitPrice: 1000, price: 1000 }] }));

    const created = orderRepository.create.mock.calls[0][0];
    expect(created.items[0].unitPrice).toBe(189_000);
    expect(created.items[0].lineTotal).toBe(378_000);
    expect(created.subtotal).toBe(378_000);
    // Under the free-shipping threshold, so the flat fee applies.
    expect(created.shippingFee).toBe(30_000);
    expect(created.total).toBe(408_000);
  });

  it("creates the order as unpaid and pending, never as confirmed", async () => {
    await processCheckout(checkoutInput());

    const created = orderRepository.create.mock.calls[0][0];
    expect(created.paymentStatus).toBe("pending");
    expect(created.orderStatus).toBe("pending");
    expect(created.paymentMethod).toBe("bank_transfer");
  });

  it("waives shipping once the subtotal reaches the free-shipping threshold", async () => {
    await processCheckout(checkoutInput({ items: [{ productId: String(PRODUCT_ID), sku: "AUR-300", quantity: 3 }] }));

    const created = orderRepository.create.mock.calls[0][0];
    expect(created.subtotal).toBe(567_000);
    expect(created.shippingFee).toBe(0);
  });
});

describe("everything runs inside one transaction", () => {
  it("threads the session through the stock decrement, the order and the payment", async () => {
    await processCheckout(checkoutInput());

    expect(productRepository.findById).toHaveBeenCalledWith(String(PRODUCT_ID), SESSION);
    expect(productRepository.decrementVariantStock).toHaveBeenCalledWith(PRODUCT_ID, "AUR-300", 2, SESSION);
    expect(orderRepository.create).toHaveBeenCalledWith(expect.any(Object), SESSION);
    expect(buildPaymentForOrder).toHaveBeenCalledWith(expect.any(Object), SESSION);
  });

  it("updates denormalised customer stats only after the transaction, and never fails the order for them", async () => {
    customerRepository.upsertFromOrder.mockRejectedValue(new Error("duplicate key"));

    const result = await processCheckout(checkoutInput());

    // The order still came back despite the stats write failing.
    expect(result.order).toBeTruthy();
    expect(customerRepository.upsertFromOrder).toHaveBeenCalledTimes(1);
    // Never passed a session: it must not be able to abort the checkout.
    expect(customerRepository.upsertFromOrder.mock.calls[0]).toHaveLength(1);
  });

  it("renders the QR after the commit rather than inside the transaction", async () => {
    await processCheckout(checkoutInput());

    // buildPaymentForOrder is the in-transaction half and never renders an image.
    expect(renderPaymentView).toHaveBeenCalledTimes(1);
    expect(renderPaymentView).toHaveBeenCalledWith(expect.objectContaining({ qrPayload: "000201..." }), true);
  });
});

describe("inventory races", () => {
  it("rejects the checkout when the conditional decrement loses the race", async () => {
    // The read said there was stock; by the time we decremented, someone else took it.
    productRepository.decrementVariantStock.mockResolvedValue(null);

    await expect(processCheckout(checkoutInput())).rejects.toMatchObject({ statusCode: 409 });
    expect(orderRepository.create).not.toHaveBeenCalled();
  });

  it("rejects a quantity larger than the variant's stock", async () => {
    await expect(
      processCheckout(checkoutInput({ items: [{ productId: String(PRODUCT_ID), sku: "AUR-500", quantity: 3 }] }))
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(productRepository.decrementVariantStock).not.toHaveBeenCalled();
  });

  it("rejects a cart that lists the same SKU twice", async () => {
    // Two lines of 2 against a stock of 2 would each pass a check made against
    // the pre-decrement quantity, reserving 4 units that do not exist.
    await expect(
      processCheckout(
        checkoutInput({
          items: [
            { productId: String(PRODUCT_ID), sku: "AUR-500", quantity: 2 },
            { productId: String(PRODUCT_ID), sku: "AUR-500", quantity: 2 },
          ],
        })
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(productRepository.decrementVariantStock).not.toHaveBeenCalled();
  });

  it("refuses a product that is no longer on sale", async () => {
    productRepository.findById.mockResolvedValue({ ...PRODUCT, status: "archived" });

    await expect(processCheckout(checkoutInput())).rejects.toMatchObject({ statusCode: 400 });
    expect(productRepository.decrementVariantStock).not.toHaveBeenCalled();
  });

  it("refuses a SKU that does not belong to the product", async () => {
    await expect(
      processCheckout(checkoutInput({ items: [{ productId: String(PRODUCT_ID), sku: "NOT-A-SKU", quantity: 1 }] }))
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("coupon races", () => {
  const COUPON = {
    _id: COUPON_ID,
    code: "LYLA10",
    type: "percentage",
    value: 10,
    isActive: true,
    usageCount: 4,
    usageLimit: 5,
    minimumSubtotal: 0,
  };

  it("claims the redemption atomically and applies the discount", async () => {
    couponRepository.findByCode.mockResolvedValue(COUPON);
    couponRepository.claimUsage.mockResolvedValue({ ...COUPON, usageCount: 5 });

    await processCheckout(checkoutInput({ couponCode: "LYLA10" }));

    expect(couponRepository.claimUsage).toHaveBeenCalledWith(String(COUPON_ID), expect.any(Date), SESSION);
    const created = orderRepository.create.mock.calls[0][0];
    expect(created.discountTotal).toBe(37_800);
    expect(created.couponCode).toBe("LYLA10");
    expect(created.total).toBe(378_000 - 37_800 + 30_000);
  });

  it("rejects the checkout when another buyer took the last redemption first", async () => {
    couponRepository.findByCode.mockResolvedValue(COUPON);
    // Validation passed on a stale read; the atomic claim is what catches it.
    couponRepository.claimUsage.mockResolvedValue(null);

    await expect(processCheckout(checkoutInput({ couponCode: "LYLA10" }))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(orderRepository.create).not.toHaveBeenCalled();
  });

  it("rejects an exhausted coupon before even attempting the claim", async () => {
    couponRepository.findByCode.mockResolvedValue({ ...COUPON, usageCount: 5 });

    await expect(processCheckout(checkoutInput({ couponCode: "LYLA10" }))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(couponRepository.claimUsage).not.toHaveBeenCalled();
  });

  it("never lets a fixed discount push the total below zero", async () => {
    couponRepository.findByCode.mockResolvedValue({
      _id: COUPON_ID,
      code: "GIAM1TRIEU",
      type: "fixed",
      value: 1_000_000,
      isActive: true,
      usageCount: 0,
      minimumSubtotal: 0,
    });
    couponRepository.claimUsage.mockResolvedValue({ _id: COUPON_ID });

    await processCheckout(checkoutInput({ couponCode: "GIAM1TRIEU" }));

    const created = orderRepository.create.mock.calls[0][0];
    expect(created.discountTotal).toBe(378_000);
    expect(created.total).toBe(30_000);
    expect(created.total).toBeGreaterThanOrEqual(0);
  });
});
