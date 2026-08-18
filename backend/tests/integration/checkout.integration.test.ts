import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

/**
 * End-to-end checkout against a REAL MongoDB replica set.
 *
 * The unit tests stub the repositories, so they can only prove that the service
 * asks for the right things. These prove the things MongoDB itself has to
 * guarantee, which no stub can stand in for:
 *
 *   - a failed checkout leaves NO trace (the transaction really aborts)
 *   - concurrent buyers cannot oversell a SKU
 *   - concurrent buyers cannot overspend a coupon's usage limit
 *
 * Skipped automatically when no replica set is reachable, so `npm test` still
 * runs anywhere; run `docker compose up -d mongo` to include them.
 */

const TEST_URI =
  process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/lylaglass_test?replicaSet=rs0&directConnection=true";

// env.ts snapshots process.env at import time, so configuration has to be in
// place before any application module is loaded.
process.env.MONGODB_URI = TEST_URI;
process.env.NODE_ENV = "test";
process.env.VIETQR_ACCOUNT_NUMBER = "0338123456789";
process.env.VIETQR_ACCOUNT_NAME = "LYLAGLASS TEST";
process.env.VIETQR_BANK_BIN = "970423";
process.env.EMAIL_PROVIDER = "log";
process.env.PAYMENT_TTL_MINUTES = "15";

async function replicaSetAvailable(): Promise<boolean> {
  try {
    const probe = await mongoose.createConnection(TEST_URI, { serverSelectionTimeoutMS: 2000 }).asPromise();
    const info = (await probe.db!.admin().command({ hello: 1 })) as { setName?: string };
    await probe.close();
    return Boolean(info.setName);
  } catch {
    return false;
  }
}

const available = await replicaSetAvailable();

const suite = available ? describe : describe.skip;
if (!available) {
  // eslint-disable-next-line no-console
  console.warn(`[skip] Không kết nối được replica set tại ${TEST_URI} — bỏ qua integration test.`);
}

suite("checkout against a real replica set", async () => {
  const { connectDatabase, disconnectDatabase, ensureCriticalIndexes, supportsTransactions } = await import(
    "@/config/db"
  );
  const { processCheckout } = await import("@/services/checkout.service");
  const { CategoryModel } = await import("@/models/Category.model");
  const { ProductModel } = await import("@/models/Product.model");
  const { OrderModel } = await import("@/models/Order.model");
  const { PaymentModel } = await import("@/models/Payment.model");
  const { CouponModel } = await import("@/models/Coupon.model");
  const { CustomerModel } = await import("@/models/Customer.model");
  const { SettingsModel } = await import("@/models/Settings.model");

  let categoryId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDatabase();
    await ensureCriticalIndexes();

    const category = await CategoryModel.findOneAndUpdate(
      { slug: "test-category" },
      { name: "Test", slug: "test-category" },
      { upsert: true, new: true }
    );
    categoryId = category!._id;

    await SettingsModel.findOneAndUpdate(
      { key: "store" },
      { key: "store", freeShippingThreshold: 490_000, flatShippingFee: 30_000 },
      { upsert: true }
    );
  });

  afterEach(async () => {
    await Promise.all([
      ProductModel.deleteMany({}),
      OrderModel.deleteMany({}),
      PaymentModel.deleteMany({}),
      CouponModel.deleteMany({}),
      CustomerModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await CategoryModel.deleteMany({});
    await SettingsModel.deleteMany({});
    await disconnectDatabase();
  });

  async function seedProduct(inventoryQty: number, price = 189_000) {
    return ProductModel.create({
      name: "Ly thủy tinh Aurora",
      slug: `aurora-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      categoryId,
      status: "active",
      images: [{ url: "https://cdn.test/a.jpg" }],
      variants: [{ sku: "AUR-300", name: "300ml", price, inventoryQty }],
    });
  }

  function input(productId: string, quantity: number, extra: Record<string, unknown> = {}) {
    return {
      customer: { name: "Nguyễn Văn A", email: `buyer${Math.random().toString(36).slice(2, 8)}@example.com`, phone: "0900000000" },
      shippingAddress: {
        fullName: "Nguyễn Văn A",
        phone: "0900000000",
        line1: "12 Nguyễn Huệ",
        province: "TP. Hồ Chí Minh",
      },
      items: [{ productId, sku: "AUR-300", quantity }],
      paymentMethod: "bank_transfer",
      ...extra,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  it("confirms the deployment supports transactions", () => {
    expect(supportsTransactions()).toBe(true);
  });

  it("writes order, payment and stock decrement as one committed unit", async () => {
    const product = await seedProduct(5);

    const result = await processCheckout(input(String(product._id), 2));

    expect(result.order.orderStatus).toBe("pending");
    expect(result.order.paymentStatus).toBe("pending");
    expect(result.payment.qrCodeDataUrl.startsWith("data:image/png;base64,")).toBe(true);

    const [orders, payments, refreshed] = await Promise.all([
      OrderModel.countDocuments(),
      PaymentModel.countDocuments(),
      ProductModel.findById(product._id).lean(),
    ]);
    expect(orders).toBe(1);
    expect(payments).toBe(1);
    expect(refreshed!.variants[0].inventoryQty).toBe(3);
  });

  it("leaves nothing behind when the checkout fails mid-transaction", async () => {
    const product = await seedProduct(1);

    // Asking for more than exists fails after the product read but before any
    // order exists — the whole transaction must vanish.
    await expect(processCheckout(input(String(product._id), 5))).rejects.toMatchObject({ statusCode: 409 });

    const [orders, payments, refreshed] = await Promise.all([
      OrderModel.countDocuments(),
      PaymentModel.countDocuments(),
      ProductModel.findById(product._id).lean(),
    ]);
    expect(orders).toBe(0);
    expect(payments).toBe(0);
    expect(refreshed!.variants[0].inventoryQty).toBe(1);
  });

  it("never oversells: 8 concurrent buyers of 1 unit against a stock of 3", async () => {
    const product = await seedProduct(3);

    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, () => processCheckout(input(String(product._id), 1)))
    );

    const fulfilled = attempts.filter((a) => a.status === "fulfilled");
    const rejected = attempts.filter((a) => a.status === "rejected");

    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(5);
    // Every loser failed for the right reason, not an internal error.
    for (const failure of rejected) {
      expect((failure as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409 });
    }

    const refreshed = await ProductModel.findById(product._id).lean();
    expect(refreshed!.variants[0].inventoryQty).toBe(0);
    // Exactly one order and one payment per successful buyer — no orphans.
    expect(await OrderModel.countDocuments()).toBe(3);
    expect(await PaymentModel.countDocuments()).toBe(3);
  });

  it("never overspends a coupon: 6 concurrent buyers against a limit of 2", async () => {
    const product = await seedProduct(20);
    await CouponModel.create({
      code: "LYLA10",
      type: "percentage",
      value: 10,
      isActive: true,
      usageLimit: 2,
      usageCount: 0,
      minimumSubtotal: 0,
    });

    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, () => processCheckout(input(String(product._id), 1, { couponCode: "LYLA10" })))
    );

    const fulfilled = attempts.filter((a) => a.status === "fulfilled");
    expect(fulfilled).toHaveLength(2);

    const coupon = await CouponModel.findOne({ code: "LYLA10" }).lean();
    expect(coupon!.usageCount).toBe(2);

    // The four rejected checkouts must not have consumed stock either.
    const refreshed = await ProductModel.findById(product._id).lean();
    expect(refreshed!.variants[0].inventoryQty).toBe(18);
    expect(await OrderModel.countDocuments()).toBe(2);
  });

  it("enforces one payment per order through the unique idempotency key", async () => {
    const product = await seedProduct(5);
    const result = await processCheckout(input(String(product._id), 1));

    await expect(
      PaymentModel.create({
        orderId: result.order._id,
        provider: "vietqr",
        intentId: "DUPLICATE",
        idempotencyKey: `checkout_${result.order._id}`,
        amount: 1000,
        paymentCode: "DUPLICATE",
        expiresAt: new Date(),
      })
    ).rejects.toMatchObject({ code: 11000 });
  });
});
