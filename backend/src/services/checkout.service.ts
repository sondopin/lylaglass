import { Types } from "mongoose";
import { z } from "zod";
import { ApiError } from "@/utils/ApiError";
import { generateOrderNumber } from "@/utils/orderNumber";
import { productRepository } from "@/repositories/product.repository";
import { orderRepository } from "@/repositories/order.repository";
import { paymentRepository } from "@/repositories/payment.repository";
import { customerRepository } from "@/repositories/customer.repository";
import { couponRepository } from "@/repositories/coupon.repository";
import { evaluateCoupon } from "./coupon.service";
import { calculateShippingFee } from "./shipping.service";
import { getPaymentProvider } from "@/payments";
import { createCheckoutSchema } from "@/validators/order.validators";
import { logger } from "@/config/logger";

type CheckoutInput = z.infer<typeof createCheckoutSchema>;

interface ReservedItem {
  productId: Types.ObjectId;
  sku: string;
  quantity: number;
}

/**
 * Rolls back stock for items that were already decremented before a later
 * item in the same checkout failed, so a partially-out-of-stock cart never
 * leaves other items permanently reserved.
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

export async function processCheckout(input: CheckoutInput) {
  // 1. Load current product/variant data server-side — price and stock are
  // never trusted from the client, only productId/sku/quantity are.
  const productDocs = await Promise.all(input.items.map((item) => productRepository.findById(item.productId)));

  const lineItems: Array<{
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
  }> = [];

  for (let i = 0; i < input.items.length; i++) {
    const reqItem = input.items[i];
    const product = productDocs[i];
    if (!product || product.status !== "active") {
      throw ApiError.badRequest(`Sản phẩm không còn tồn tại hoặc đã ngừng bán`);
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

  // 2. Reserve stock atomically, one SKU at a time; roll back everything
  // already reserved if any later item can't be reserved (lost the race).
  const reserved: ReservedItem[] = [];
  for (const item of lineItems) {
    const updated = await productRepository.decrementVariantStock(item.productId, item.sku, item.quantity);
    if (!updated) {
      await releaseReservedStock(reserved);
      throw ApiError.conflict(`"${item.productName} - ${item.variantName}" vừa hết hàng, vui lòng thử lại`, {
        sku: item.sku,
      });
    }
    reserved.push({ productId: item.productId, sku: item.sku, quantity: item.quantity });
  }

  try {
    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);

    let discountTotal = 0;
    let freeShipping = false;
    let couponCode = "";
    if (input.couponCode) {
      const evaluation = await evaluateCoupon(input.couponCode, subtotal);
      discountTotal = evaluation.discountTotal;
      freeShipping = evaluation.freeShipping;
      couponCode = evaluation.code;
    }

    const shippingFee = await calculateShippingFee(subtotal, freeShipping);
    const total = Math.max(subtotal - discountTotal + shippingFee, 0);

    const orderNumber = generateOrderNumber();
    const isCod = input.paymentMethod === "cod";

    const order = await orderRepository.create({
      orderNumber,
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
      paymentMethod: input.paymentMethod,
      paymentStatus: "pending",
      orderStatus: isCod ? "confirmed" : "pending",
      shippingStatus: "unfulfilled",
    });

    await customerRepository.upsertFromOrder({
      name: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone,
      orderTotal: total,
    });

    if (couponCode) {
      const coupon = await couponRepository.findByCode(couponCode);
      if (coupon) await couponRepository.incrementUsage(String(coupon._id));
    }

    // COD never touches an external payment gateway — nothing to verify server-side beyond delivery.
    if (isCod) {
      return { order: order.toObject(), payment: null, redirectUrl: null };
    }

    const provider = getPaymentProvider();
    const intent = await provider.createPaymentIntent({
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      amount: total,
      currency: "VND",
      customerEmail: input.customer.email,
    });

    const payment = await paymentRepository.create({
      orderId: order._id,
      provider: provider.name,
      intentId: intent.intentId,
      idempotencyKey: `checkout_${order._id}`,
      amount: total,
      currency: "VND",
      status: intent.status,
    });

    const updatedOrder = await orderRepository.updateById(String(order._id), { paymentId: payment._id });

    return { order: updatedOrder, payment, redirectUrl: intent.redirectUrl ?? null };
  } catch (err) {
    // Any failure after stock was reserved but before the order is durably
    // recorded must give the stock back.
    await releaseReservedStock(reserved);
    throw err;
  }
}
