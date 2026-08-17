/**
 * One-off migration for the switch to VietQR-only payments.
 *
 * Both `Order.paymentMethod` and `Payment.provider` lost their old enum values,
 * and Payment gained required fields (`paymentCode`, `expiresAt`) plus unique
 * indexes. Documents written by any earlier scheme therefore have to be
 * normalised or removed.
 *
 * Why this matters beyond tidiness: MongoDB **cannot build a unique index while
 * documents violate it**, and Mongoose's automatic index creation fails
 * silently. Every legacy Payment lacking `paymentCode` counts as a duplicate
 * `null`, so as long as one exists the unique index on `paymentCode` is missing
 * — and with it the guarantee that two orders can never share a payment code.
 * This script removes the blockers, rebuilds the indexes, then **verifies** they
 * exist and fails loudly if they do not.
 *
 * Run:  npm run migrate:vietqr                              (dry run — reports only)
 *       npm run migrate:vietqr -- --apply                    (normalise + rebuild indexes)
 *       npm run migrate:vietqr -- --apply --purge-orders     (also delete unusable orders)
 *
 * Legacy Payment documents are deleted rather than converted: they describe
 * mock/Stripe intents or an earlier bank-transfer experiment that never
 * corresponded to a transfer this system can reconcile. Orders are kept by
 * default — deleting order history is opt-in via --purge-orders.
 */
import mongoose from "mongoose";
import { connectDatabase } from "@/config/db";
import { logger } from "@/config/logger";
import { OrderModel } from "@/models/Order.model";
import { PaymentModel } from "@/models/Payment.model";

const LEGACY_ORDER_METHODS = ["cod", "card", "mock"];
const VALID_PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

/** Indexes the new schema depends on for correctness, not just for speed. */
const REQUIRED_PAYMENT_INDEXES = ["paymentCode_1", "idempotencyKey_1", "transactionId_1"];

/** Payments the new schema cannot represent, and which block its unique indexes. */
const INCOMPATIBLE_PAYMENT_QUERY = {
  $or: [{ provider: { $ne: "vietqr" } }, { paymentCode: { $exists: false } }, { expiresAt: { $exists: false } }],
};

/** Orders written by a schema so different that they fail validation on any save. */
const UNUSABLE_ORDER_QUERY = {
  $or: [
    { orderStatus: { $exists: false } },
    { paymentStatus: { $nin: VALID_PAYMENT_STATUSES } },
    { orderNumber: { $exists: false } },
  ],
};

async function main() {
  const apply = process.argv.includes("--apply");
  const purgeOrders = process.argv.includes("--purge-orders");

  await connectDatabase();

  const legacyMethodOrders = await OrderModel.countDocuments({ paymentMethod: { $in: LEGACY_ORDER_METHODS } });
  const unusableOrders = await OrderModel.countDocuments(UNUSABLE_ORDER_QUERY);
  const incompatiblePayments = await PaymentModel.countDocuments(INCOMPATIBLE_PAYMENT_QUERY);
  const totalPayments = await PaymentModel.countDocuments();

  const existingIndexes = (await PaymentModel.collection.indexes()).map((index) => index.name);
  const missingIndexes = REQUIRED_PAYMENT_INDEXES.filter((name) => !existingIndexes.includes(name));

  logger.info(
    {
      mode: apply ? "apply" : "dry-run",
      legacyMethodOrders,
      unusableOrders,
      incompatiblePayments,
      totalPayments,
      missingPaymentIndexes: missingIndexes,
    },
    "VietQR migration scan"
  );

  if (missingIndexes.length > 0) {
    logger.warn(
      { missingPaymentIndexes: missingIndexes },
      "Thiếu unique index bắt buộc trên Payment — thường do dữ liệu cũ vi phạm ràng buộc. Migration sẽ dọn dữ liệu rồi tạo lại."
    );
  }
  if (unusableOrders > 0 && !purgeOrders) {
    logger.warn(
      { unusableOrders },
      "Có đơn hàng thuộc schema cũ không còn hợp lệ (thiếu orderStatus / paymentStatus ngoài enum). Chúng được GIỮ LẠI; thêm --purge-orders nếu muốn xoá."
    );
  }

  if (!apply) {
    logger.info("Chạy lại với --apply để thực hiện thay đổi.");
    await mongoose.disconnect();
    return;
  }

  // 1. Normalise the payment method label on orders that are otherwise fine.
  const orderResult = await OrderModel.updateMany(
    { paymentMethod: { $in: LEGACY_ORDER_METHODS } },
    { $set: { paymentMethod: "bank_transfer" } }
  );
  logger.info({ modified: orderResult.modifiedCount }, "Orders: paymentMethod -> bank_transfer");

  // 2. Drop payments the new schema cannot represent, and unlink them first so
  // no order is left pointing at a deleted document.
  const incompatibleIds = (await PaymentModel.find(INCOMPATIBLE_PAYMENT_QUERY).select("_id").lean()).map((d) => d._id);
  if (incompatibleIds.length > 0) {
    const unlinked = await OrderModel.updateMany({ paymentId: { $in: incompatibleIds } }, { $unset: { paymentId: "" } });
    const deleted = await PaymentModel.deleteMany({ _id: { $in: incompatibleIds } });
    logger.info(
      { deletedPayments: deleted.deletedCount, ordersUnlinked: unlinked.modifiedCount },
      "Đã xoá payment không tương thích với schema mới"
    );
  }

  // 3. Optionally remove orders that can never validate again.
  if (purgeOrders) {
    const purged = await OrderModel.deleteMany(UNUSABLE_ORDER_QUERY);
    logger.info({ deletedOrders: purged.deletedCount }, "Đã xoá đơn hàng thuộc schema cũ không hợp lệ");
  }

  // 4. Drop any same-key index left by an earlier schema, then rebuild from the
  // current schema definition.
  for (const index of await PaymentModel.collection.indexes()) {
    const isStaleTransactionIndex = index.name?.startsWith("transactionId_1") && !index.partialFilterExpression;
    // An earlier bank-transfer experiment used a different field name for the
    // bank's transaction id; its unique index no longer matches anything.
    const isForeignIndex = index.name === "gatewayTransactionId_1";
    if (index.name && (isStaleTransactionIndex || isForeignIndex)) {
      await PaymentModel.collection.dropIndex(index.name);
      logger.info({ index: index.name }, "Đã xoá index cũ không còn dùng");
    }
  }

  await PaymentModel.syncIndexes();
  await OrderModel.syncIndexes();

  // 5. Verify — an index that failed to build must never pass silently, because
  // the uniqueness guarantees are part of how payments stay correct.
  const rebuilt = (await PaymentModel.collection.indexes()).map((index) => index.name);
  const stillMissing = REQUIRED_PAYMENT_INDEXES.filter((name) => !rebuilt.includes(name));
  if (stillMissing.length > 0) {
    throw new Error(
      `Không tạo được unique index bắt buộc: ${stillMissing.join(", ")}. ` +
        "Kiểm tra dữ liệu Payment còn trùng lặp (paymentCode/idempotencyKey) rồi chạy lại."
    );
  }

  logger.info({ paymentIndexes: rebuilt }, "Migration hoàn tất, index đã được xác minh");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  logger.error({ err }, "Migration thất bại");
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
