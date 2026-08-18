import { ClientSession, Types } from "mongoose";
import { z } from "zod";
import { ApiError } from "@/utils/ApiError";
import { generateOrderNumber } from "@/utils/orderNumber";
import { supportsTransactions, withTransaction } from "@/config/db";
import { productRepository } from "@/repositories/product.repository";
import { orderRepository } from "@/repositories/order.repository";
import { customerRepository } from "@/repositories/customer.repository";
import { couponRepository } from "@/repositories/coupon.repository";
import { evaluateCoupon } from "./coupon.service";
import { calculateShippingFee } from "./shipping.service";
import { buildPaymentForOrder, renderPaymentView } from "./payment.service";
import { releaseOrderReservations } from "./order.service";
import { createCheckoutSchema } from "@/validators/order.validators";
import { OrderRecord } from "@/repositories/order.repository";
import { PaymentRecord } from "@/repositories/payment.repository";
import { logger } from "@/config/logger";

type CheckoutInput = z.infer<typeof createCheckoutSchema>;

interface ReservedItem {
  productId: Types.ObjectId;
  sku: string;
  quantity: number;
}

interface LineItem {
  productId: Types.ObjectId;
  productName: string;
  slug: string;
  image: string;
  sku: string;
  variantName: string;
  variantAttributes: Record<string, string>;
  quantity: number;
  unitPrice: number;
  compareAtPrice?: number;
  lineTotal: number;
}

/**
 * Rolls back stock reserved by a checkout that failed before the order existed.
 * Only ever reached in degraded (non-transactional) mode — with a transaction
 * the abort undoes the decrements for us.
 */
async function releaseReservedStock(reserved: ReservedItem[]) {
  await Promise.all(
    reserved.map((item) =>
      productRepository.restockVariant(item.productId, item.sku, item.quantity).catch((err) => {
        logger.error({ err, item }, "Failed to release reserved stock after checkout failure");
      })
    )
  );
}

/**
 * Loads the products the cart refers to and rebuilds every line from the
 * database.
 *
 * The client only ever supplies `productId`, `sku` and `quantity`; name, price
 * and image are taken from the current product document, so a tampered cart
 * cannot buy a 500.000đ glass for 1.000đ, and a snapshot of what was actually
 * charged is frozen onto the order.
 */
async function buildLineItems(input: CheckoutInput, session?: ClientSession): Promise<LineItem[]> {
  const lineItems: LineItem[] = [];

  // Sequential on purpose: a ClientSession cannot carry concurrent operations,
  // so `Promise.all` over session-bound reads would corrupt the transaction.
  for (const reqItem of input.items) {
    const product = await productRepository.findById(reqItem.productId, session);
    if (!product || product.status !== "active") {
      throw ApiError.badRequest("Sản phẩm không còn tồn tại hoặc đã ngừng bán");
    }

    const variant = product.variants.find((v) => v.sku === reqItem.sku);
    if (!variant) throw ApiError.badRequest(`Biến thể "${reqItem.sku}" không tồn tại cho sản phẩm ${product.name}`);
    if (variant.inventoryQty < reqItem.quantity) {
      throw ApiError.conflict(`"${product.name} - ${variant.name}" chỉ còn ${variant.inventoryQty} sản phẩm trong kho`, {
        sku: variant.sku,
        available: variant.inventoryQty,
      });
    }

    lineItems.push({
      productId: product._id,
      productName: product.name,
      slug: product.slug,
      image: product.images[0]?.url ?? "",
      sku: variant.sku,
      variantName: variant.name,
      // Mongoose's .lean() already serializes Map fields to plain objects.
      variantAttributes: (variant.attributes as unknown as Record<string, string>) ?? {},
      quantity: reqItem.quantity,
      unitPrice: variant.price,
      compareAtPrice: variant.compareAtPrice ?? undefined,
      lineTotal: variant.price * reqItem.quantity,
    });
  }

  return lineItems;
}

/**
 * Rejects a cart that names the same SKU twice.
 *
 * Without this, two lines of 5 against a stock of 8 would each be checked
 * against the *pre-decrement* quantity read at the start, and both could pass
 * validation even though only one can actually be reserved. Deduplicating up
 * front is clearer than trying to make the checks cumulative.
 */
function assertNoDuplicateSkus(input: CheckoutInput) {
  const seen = new Set<string>();
  for (const item of input.items) {
    const key = `${item.productId}:${item.sku}`;
    if (seen.has(key)) {
      throw ApiError.badRequest("Giỏ hàng có sản phẩm bị trùng, vui lòng tải lại trang và thử lại");
    }
    seen.add(key);
  }
}

/**
 * Turns a validated cart into an order plus the VietQR the customer transfers
 * against.
 *
 * Everything that must agree — stock, coupon usage, order totals, payment
 * record — is written inside a single transaction, so the outcome is either a
 * complete order with its stock reserved, or nothing at all. Nothing here talks
 * to the network or sends email: those side effects cannot be rolled back and
 * `withTransaction` may run this body more than once on a write conflict.
 */
export async function processCheckout(input: CheckoutInput) {
  assertNoDuplicateSkus(input);

  const transactional = supportsTransactions();
  // Only used to unwind the degraded path; with a real transaction, aborting
  // undoes these writes and the list stays unused.
  const reserved: ReservedItem[] = [];
  let orderForCompensation: OrderRecord | null = null;

  try {
    const { order, payment } = await withTransaction(async (session) => {
      const lineItems = await buildLineItems(input, session);

      // Reserve stock atomically, one SKU at a time. The conditional decrement
      // is the real guard against overselling; the read above only produces a
      // friendlier error message for the common case.
      for (const item of lineItems) {
        const updated = await productRepository.decrementVariantStock(
          item.productId,
          item.sku,
          item.quantity,
          session
        );
        if (!updated) {
          throw ApiError.conflict(`"${item.productName} - ${item.variantName}" vừa hết hàng, vui lòng thử lại`, {
            sku: item.sku,
          });
        }
        if (!transactional) reserved.push({ productId: item.productId, sku: item.sku, quantity: item.quantity });
      }

      const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);

      let discountTotal = 0;
      let freeShipping = false;
      let couponCode = "";
      if (input.couponCode) {
        const evaluation = await evaluateCoupon(input.couponCode, subtotal, session);

        // Claim the redemption in the same breath as validating it: the claim
        // re-checks the usage limit and validity window atomically, so a
        // last-slot coupon cannot be handed to two simultaneous checkouts.
        const claimed = await couponRepository.claimUsage(String(evaluation.couponId), new Date(), session);
        if (!claimed) throw ApiError.badRequest("Mã giảm giá vừa hết lượt sử dụng hoặc không còn hiệu lực");

        discountTotal = evaluation.discountTotal;
        freeShipping = evaluation.freeShipping;
        couponCode = evaluation.code;
      }

      const shippingFee = await calculateShippingFee(subtotal, freeShipping);
      const total = Math.max(subtotal - discountTotal + shippingFee, 0);

      const createdOrder = await orderRepository.create(
        {
          orderNumber: generateOrderNumber(),
          customer: { name: input.customer.name, email: input.customer.email, phone: input.customer.phone },
          shippingAddress: input.shippingAddress,
          billingAddress: input.billingAddress ?? input.shippingAddress,
          items: lineItems,
          subtotal,
          shippingFee,
          discountTotal,
          couponCode,
          total,
          customerNote: input.customerNote ?? "",
          paymentMethod: "bank_transfer",
          paymentStatus: "pending",
          // Stays pending until an incoming bank transfer is verified server-side.
          orderStatus: "pending",
          shippingStatus: "unfulfilled",
        },
        session
      );

      // Mongoose types a hydrated document's Maps differently from a lean
      // record's plain objects; toObject() flattens them at runtime, so the
      // cast goes through `unknown` rather than being widened field by field.
      const orderRecord = createdOrder.toObject() as unknown as OrderRecord;
      if (!transactional) orderForCompensation = orderRecord;

      // Builds the Payment + VietQR payload. Scanning that QR proves nothing —
      // the order only becomes paid once an incoming transfer is verified
      // through the bank webhook.
      const createdPayment = await buildPaymentForOrder(orderRecord, session);

      const withPaymentId = await orderRepository.updateById(
        String(createdOrder._id),
        { paymentId: createdPayment._id },
        session
      );

      return { order: withPaymentId ?? orderRecord, payment: createdPayment };
    });

    // --- Everything below happens only after a durable commit ---------------

    // Denormalised customer stats. Deliberately outside the transaction: an
    // upsert racing another checkout by the same new customer can raise a
    // duplicate-key error, which is *not* a transient error and would abort an
    // otherwise perfectly good order. It is derived data, so a failure is
    // logged and swallowed rather than shown to the buyer.
    try {
      await customerRepository.upsertFromOrder({
        name: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone,
        orderTotal: order.total,
      });
    } catch (err) {
      logger.error({ err, orderNumber: order.orderNumber }, "Cập nhật thống kê khách hàng thất bại (bỏ qua)");
    }

    // Rendering the QR image is CPU work with no reason to hold a transaction open.
    return {
      order,
      payment: await renderPaymentView(payment as PaymentRecord, true),
    };
  } catch (err) {
    // With transactions this is unreachable for DB failures — the abort already
    // undid everything. It remains as the compensating path for degraded mode.
    if (orderForCompensation) {
      const staleOrder = orderForCompensation as OrderRecord;
      await orderRepository.updateById(String(staleOrder._id), {
        paymentStatus: "failed",
        orderStatus: "cancelled",
      });
      await releaseOrderReservations(staleOrder);
    } else if (reserved.length > 0) {
      await releaseReservedStock(reserved);
    }
    throw err;
  }
}
