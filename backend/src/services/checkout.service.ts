import { Types } from "mongoose";
import { z } from "zod";
import { ApiError } from "@/utils/ApiError";
import { generateOrderNumber } from "@/utils/orderNumber";
import { productRepository } from "@/repositories/product.repository";
import { orderRepository } from "@/repositories/order.repository";
import { customerRepository } from "@/repositories/customer.repository";
import { couponRepository } from "@/repositories/coupon.repository";
import { evaluateCoupon } from "./coupon.service";
import { calculateShippingFee } from "./shipping.service";
import { createPaymentForOrder, toPublicPaymentView } from "./payment.service";
import { releaseOrderReservations } from "./order.service";
import { createCheckoutSchema } from "@/validators/order.validators";
import { Order } from "@/models/Order.model";
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

  // Tracked so a failure *after* the order exists unwinds through the guarded
  // release path (which flags the order) instead of restocking behind its back.
  let createdOrder: Order | null = null;

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
      paymentMethod: "bank_transfer",
      paymentStatus: "pending",
      // Stays pending until an incoming bank transfer is verified server-side.
      orderStatus: "pending",
      shippingStatus: "unfulfilled",
    });
    createdOrder = order.toObject() as Order;

    // Charged immediately after the order exists, so the compensating release
    // below can always tell whether a use needs giving back.
    if (couponCode) {
      const coupon = await couponRepository.findByCode(couponCode);
      if (coupon) await couponRepository.incrementUsage(String(coupon._id));
    }

    await customerRepository.upsertFromOrder({
      name: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone,
      orderTotal: total,
    });

    // Create the payment + VietQR the customer will transfer against. Scanning
    // that QR proves nothing — the order only becomes paid once an incoming
    // transfer is verified through the bank webhook.
    const { payment, qrCodeDataUrl } = await createPaymentForOrder(createdOrder);

    const updatedOrder = await orderRepository.updateById(String(order._id), { paymentId: payment._id });

    return {
      order: updatedOrder,
      payment: { ...toPublicPaymentView(payment), qrCodeDataUrl },
    };
  } catch (err) {
    // Any failure after stock was reserved must give the stock back.
    if (createdOrder) {
      // The order is already persisted, so unwind it the same way an expired
      // payment does — cancelled, and released exactly once.
      await orderRepository.updateById(String(createdOrder._id), {
        paymentStatus: "failed",
        orderStatus: "cancelled",
      });
      await releaseOrderReservations(createdOrder);
    } else {
      await releaseReservedStock(reserved);
    }
    throw err;
  }
}
