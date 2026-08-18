import { Types } from "mongoose";
import { logger } from "@/config/logger";
import { OrderModel } from "@/models/Order.model";
import { PaymentModel } from "@/models/Payment.model";
import { ProductModel } from "@/models/Product.model";
import { CustomerModel } from "@/models/Customer.model";
import { BankTransactionModel } from "@/models/BankTransaction.model";
import { buildVietQrPayload } from "@/payments/vietqrPayload";
import { env } from "@/config/env";

/**
 * Demo orders covering every state the admin screens can show.
 *
 * The point is not volume but *coverage*: without an order in each state you
 * cannot tell a working status filter from a broken one, an empty
 * reconciliation table from a bug, or a correct "needs manual review" badge
 * from one that never renders. Every record here is internally consistent —
 * order totals match their line items, paid orders have a matching Payment and
 * a matching BankTransaction, and stock is decremented for the orders that
 * actually hold it.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

interface DemoLine {
  sku: string;
  quantity: number;
}

interface DemoOrderSpec {
  orderNumber: string;
  customer: { name: string; email: string; phone: string };
  address: { line1: string; ward: string; district: string; province: string };
  lines: DemoLine[];
  placedDaysAgo: number;
  paymentStatus: "pending" | "paid" | "failed";
  orderStatus: "pending" | "confirmed" | "processing" | "completed" | "cancelled";
  shippingStatus: "unfulfilled" | "processing" | "shipped" | "delivered";
  paymentState: "open" | "succeeded" | "expired";
  /** Bank transfer that arrived for this order, if any. */
  transfer?: {
    /** Deliberately different from the order total, to exercise the mismatch path. */
    amount?: number;
    matchStatus: "matched" | "rejected";
    /**
     * Derived from the order's real total rather than hard-coded: a demo note
     * quoting a figure that disagrees with the order it sits on is worse than
     * no note at all, because it reads as a bug in the reconciliation logic.
     */
    note?: (received: number, expected: number) => string;
    needsManualReview?: (received: number, expected: number, transactionId: string) => string;
  };
  trackingNumber?: string;
  shippingCarrier?: string;
  customerNote?: string;
  note: string;
}

const SPECS: DemoOrderSpec[] = [
  {
    orderNumber: "LG20260815-D3M0A1",
    customer: { name: "Trần Thu Hà", email: "thuha.demo@example.com", phone: "0912345001" },
    address: { line1: "24 Lý Thường Kiệt", ward: "Phường Trần Hưng Đạo", district: "Hoàn Kiếm", province: "Hà Nội" },
    lines: [{ sku: "BS-250", quantity: 2 }, { sku: "WV-300", quantity: 1 }],
    placedDaysAgo: 0,
    paymentStatus: "paid",
    orderStatus: "confirmed",
    shippingStatus: "unfulfilled",
    paymentState: "succeeded",
    transfer: { matchStatus: "matched" },
    customerNote: "Giao giờ hành chính, gọi trước khi giao giúp mình nhé.",
    note: "vừa thanh toán — cần đóng gói",
  },
  {
    orderNumber: "LG20260814-D3M0A2",
    customer: { name: "Nguyễn Quốc Bảo", email: "quocbao.demo@example.com", phone: "0912345002" },
    address: { line1: "88 Nguyễn Trãi", ward: "Phường 7", district: "Quận 5", province: "TP. Hồ Chí Minh" },
    lines: [{ sku: "AD-4LY", quantity: 1 }],
    placedDaysAgo: 3,
    paymentStatus: "paid",
    orderStatus: "processing",
    shippingStatus: "shipped",
    paymentState: "succeeded",
    transfer: { matchStatus: "matched" },
    trackingNumber: "GHN2608140099",
    shippingCarrier: "Giao Hàng Nhanh",
    note: "đang giao — có mã vận đơn",
  },
  {
    orderNumber: "LG20260810-D3M0A3",
    customer: { name: "Lê Minh Anh", email: "minhanh.demo@example.com", phone: "0912345003" },
    address: { line1: "12 Trần Phú", ward: "Phường Lộc Thọ", district: "Nha Trang", province: "Khánh Hòa" },
    lines: [{ sku: "KT-300", quantity: 1 }, { sku: "CM-400", quantity: 2 }],
    placedDaysAgo: 8,
    paymentStatus: "paid",
    orderStatus: "completed",
    shippingStatus: "delivered",
    paymentState: "succeeded",
    transfer: { matchStatus: "matched" },
    trackingNumber: "GHTK2608100455",
    shippingCarrier: "Giao Hàng Tiết Kiệm",
    note: "đã hoàn tất — dùng để test doanh thu dashboard",
  },
  {
    orderNumber: "LG20260818-D3M0A4",
    customer: { name: "Phạm Gia Huy", email: "giahuy.demo@example.com", phone: "0912345004" },
    address: { line1: "5 Hùng Vương", ward: "Phường Thạc Gián", district: "Thanh Khê", province: "Đà Nẵng" },
    lines: [{ sku: "RS-300", quantity: 1 }],
    placedDaysAgo: 0,
    paymentStatus: "pending",
    orderStatus: "pending",
    shippingStatus: "unfulfilled",
    paymentState: "open",
    note: "đang chờ chuyển khoản — QR còn hiệu lực",
  },
  {
    orderNumber: "LG20260816-D3M0A5",
    customer: { name: "Đỗ Khánh Linh", email: "khanhlinh.demo@example.com", phone: "0912345005" },
    address: { line1: "30 Lê Lợi", ward: "Phường Vĩnh Ninh", district: "Thành phố Huế", province: "Thừa Thiên Huế" },
    lines: [{ sku: "TB-2LY", quantity: 1 }],
    placedDaysAgo: 2,
    paymentStatus: "failed",
    orderStatus: "cancelled",
    shippingStatus: "unfulfilled",
    paymentState: "expired",
    note: "hết hạn thanh toán — đã hoàn kho & hoàn lượt coupon",
  },
  {
    orderNumber: "LG20260817-D3M0A6",
    customer: { name: "Vũ Hoàng Nam", email: "hoangnam.demo@example.com", phone: "0912345006" },
    address: { line1: "17 Nguyễn Văn Cừ", ward: "Phường An Hòa", district: "Ninh Kiều", province: "Cần Thơ" },
    lines: [{ sku: "SH-VANG", quantity: 1 }],
    placedDaysAgo: 1,
    paymentStatus: "pending",
    orderStatus: "pending",
    shippingStatus: "unfulfilled",
    paymentState: "open",
    // Overpayment: the reconciliation rules refuse to auto-confirm it, so the
    // admin's "cần đối soát" queue has something real in it.
    transfer: {
      amount: 500_000,
      matchStatus: "rejected",
      note: (received, expected) => `Số tiền không khớp: nhận ${received}đ, cần ${expected}đ`,
      needsManualReview: (received, expected, transactionId) =>
        `Số tiền chuyển khoản thừa: nhận ${received}đ, cần ${expected}đ (giao dịch ${transactionId})`,
    },
    note: "khách chuyển thừa tiền — cần đối soát thủ công",
  },
];

/** Bank transfer that matches no order at all — the other reconciliation case. */
const ORPHAN_TRANSFER = {
  providerTransactionId: "DEMO-TX-999",
  transferAmount: 250_000,
  content: "CHUYEN TIEN CHO CON",
  note: "Không tìm thấy mã thanh toán hợp lệ trong nội dung chuyển khoản",
};

function shippingFeeFor(subtotal: number) {
  return subtotal >= 490_000 ? 0 : 30_000;
}

export async function seedDemoOrders() {
  // Every variant the specs reference, resolved to its live product/price so
  // the demo orders are never inconsistent with the seeded catalogue.
  const products = await ProductModel.find().lean();
  const bySku = new Map<string, { product: (typeof products)[number]; variant: (typeof products)[number]["variants"][number] }>();
  for (const product of products) {
    for (const variant of product.variants) bySku.set(variant.sku, { product, variant });
  }

  const orderDocs: Record<string, unknown>[] = [];
  const paymentDocs: Record<string, unknown>[] = [];
  const bankDocs: Record<string, unknown>[] = [];
  const customerTotals = new Map<string, { name: string; phone: string; count: number; total: number }>();
  const stockToDecrement = new Map<string, number>();

  for (const [index, spec] of SPECS.entries()) {
    const items = spec.lines.map((line) => {
      const found = bySku.get(line.sku);
      if (!found) throw new Error(`Seed demo order ${spec.orderNumber}: không tìm thấy SKU ${line.sku}`);
      const { product, variant } = found;
      return {
        productId: product._id,
        productName: product.name,
        slug: product.slug,
        image: product.images[0]?.url ?? "",
        sku: variant.sku,
        variantName: variant.name,
        variantAttributes: {},
        quantity: line.quantity,
        unitPrice: variant.price,
        compareAtPrice: variant.compareAtPrice ?? undefined,
        lineTotal: variant.price * line.quantity,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const shippingFee = shippingFeeFor(subtotal);
    const total = subtotal + shippingFee;

    const createdAt = new Date(Date.now() - spec.placedDaysAgo * DAY);
    const orderId = new Types.ObjectId();
    const paymentId = new Types.ObjectId();
    const paymentCode = `LGDEMO${index + 1}`;
    const transactionId = `DEMO-TX-00${index + 1}`;
    const transferAmount = spec.transfer?.amount ?? total;
    const isCancelled = spec.orderStatus === "cancelled";

    // A cancelled order has already given its stock back; every other state is
    // still holding it, so the catalogue has to reflect that.
    if (!isCancelled) {
      for (const item of items) {
        const key = `${item.productId}:${item.sku}`;
        stockToDecrement.set(key, (stockToDecrement.get(key) ?? 0) + item.quantity);
      }
    }

    orderDocs.push({
      _id: orderId,
      orderNumber: spec.orderNumber,
      customer: spec.customer,
      shippingAddress: { fullName: spec.customer.name, phone: spec.customer.phone, ...spec.address, country: "Việt Nam" },
      billingAddress: { fullName: spec.customer.name, phone: spec.customer.phone, ...spec.address, country: "Việt Nam" },
      items,
      subtotal,
      shippingFee,
      discountTotal: 0,
      couponCode: "",
      total,
      currency: "VND",
      customerNote: spec.customerNote ?? "",
      paymentMethod: "bank_transfer",
      paymentId,
      paymentStatus: spec.paymentStatus,
      orderStatus: spec.orderStatus,
      shippingStatus: spec.shippingStatus,
      shippingCarrier: spec.shippingCarrier ?? "",
      trackingNumber: spec.trackingNumber ?? "",
      inventoryReleased: isCancelled,
      couponUsageReleased: isCancelled,
      createdAt,
      updatedAt: createdAt,
    });

    const paidAt = spec.paymentState === "succeeded" ? new Date(createdAt.getTime() + 4 * MINUTE) : undefined;
    const expiresAt = new Date(createdAt.getTime() + env.payment.ttlMinutes * MINUTE);

    paymentDocs.push({
      _id: paymentId,
      orderId,
      provider: "vietqr",
      intentId: paymentCode,
      idempotencyKey: `checkout_${orderId}`,
      amount: total,
      currency: "VND",
      status: spec.paymentState === "open" ? "requires_action" : spec.paymentState,
      method: "bank_transfer",
      paymentCode,
      bankBin: env.payment.vietqr.bankBin,
      bankCode: env.payment.vietqr.bankCode,
      bankName: env.payment.vietqr.bankName,
      bankAccountNumber: env.payment.vietqr.accountNumber,
      bankAccountName: env.payment.vietqr.accountName,
      qrPayload: env.payment.vietqr.accountNumber
        ? buildVietQrPayload({
            bankBin: env.payment.vietqr.bankBin,
            accountNumber: env.payment.vietqr.accountNumber,
            amount: total,
            description: paymentCode,
          })
        : "",
      // An open payment must not look already-expired, or the sweep job would
      // cancel these demo orders the moment the server starts.
      expiresAt: spec.paymentState === "open" ? new Date(Date.now() + env.payment.ttlMinutes * MINUTE) : expiresAt,
      paidAt,
      ...(spec.paymentState === "succeeded"
        ? {
            transactionId,
            referenceCode: `FT2608${index + 1}0000${index + 1}`,
            transactionDate: paidAt,
            transferredAmount: total,
            confirmationEmailStatus: "sent",
            confirmationEmailSentAt: paidAt,
            confirmationEmailAttempts: 1,
            ownerNotificationStatus: "sent",
            ownerNotificationSentAt: paidAt,
            ownerNotificationAttempts: 1,
          }
        : {}),
      ...(spec.paymentState === "expired" ? { failureReason: "Hết thời gian chờ thanh toán" } : {}),
      ...(spec.transfer?.needsManualReview
        ? {
            needsManualReview: true,
            manualReviewReason: spec.transfer.needsManualReview(transferAmount, total, transactionId),
          }
        : {}),
      createdAt,
      updatedAt: paidAt ?? createdAt,
    });

    if (spec.transfer) {
      bankDocs.push({
        provider: "sepay",
        providerTransactionId: transactionId,
        gateway: env.payment.vietqr.bankName,
        accountNumber: env.payment.vietqr.accountNumber,
        subAccount: "",
        transferType: "in",
        transferAmount,
        accumulated: 0,
        code: paymentCode,
        content: `${paymentCode} chuyen khoan`,
        description: "",
        referenceCode: `FT2608${index + 1}0000${index + 1}`,
        transactionDate: paidAt ?? new Date(createdAt.getTime() + 6 * MINUTE),
        matchStatus: spec.transfer.matchStatus,
        matchNote: spec.transfer.note ? spec.transfer.note(transferAmount, total) : "",
        paymentId,
        orderId,
        createdAt,
      });
    }

    // Only orders that were actually paid count toward a customer's spend.
    const stats = customerTotals.get(spec.customer.email) ?? {
      name: spec.customer.name,
      phone: spec.customer.phone,
      count: 0,
      total: 0,
    };
    stats.count += 1;
    if (spec.paymentStatus === "paid") stats.total += total;
    customerTotals.set(spec.customer.email, stats);
  }

  bankDocs.push({
    provider: "sepay",
    providerTransactionId: ORPHAN_TRANSFER.providerTransactionId,
    gateway: env.payment.vietqr.bankName,
    accountNumber: env.payment.vietqr.accountNumber,
    subAccount: "",
    transferType: "in",
    transferAmount: ORPHAN_TRANSFER.transferAmount,
    accumulated: 0,
    code: "",
    content: ORPHAN_TRANSFER.content,
    description: "",
    referenceCode: "FT26089999999",
    transactionDate: new Date(),
    matchStatus: "unmatched",
    matchNote: ORPHAN_TRANSFER.note,
    createdAt: new Date(),
  });

  await OrderModel.insertMany(orderDocs);
  await PaymentModel.insertMany(paymentDocs);
  await BankTransactionModel.insertMany(bankDocs);

  await CustomerModel.insertMany(
    [...customerTotals.entries()].map(([email, stats]) => ({
      email,
      name: stats.name,
      phone: stats.phone,
      ordersCount: stats.count,
      totalSpent: stats.total,
    }))
  );

  // Reflect the stock these orders are holding, so the catalogue, the orders
  // and the inventory screen all agree with each other.
  for (const [key, quantity] of stockToDecrement) {
    const [productId, sku] = key.split(":");
    await ProductModel.updateOne(
      { _id: productId, "variants.sku": sku },
      { $inc: { "variants.$[v].inventoryQty": -quantity } },
      { arrayFilters: [{ "v.sku": sku }] }
    );
  }

  logger.info(
    `Đã tạo ${orderDocs.length} đơn demo, ${paymentDocs.length} payment, ${bankDocs.length} giao dịch ngân hàng, ${customerTotals.size} khách hàng`
  );
  for (const spec of SPECS) logger.info(`  ${spec.orderNumber} — ${spec.note}`);
}
