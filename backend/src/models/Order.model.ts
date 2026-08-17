import { Schema, model, Types, InferSchemaType } from "mongoose";

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true }, // snapshot at purchase time
    slug: { type: String, required: true },
    image: { type: String, default: "" },
    sku: { type: String, required: true },
    variantName: { type: String, required: true },
    variantAttributes: { type: Map, of: String, default: {} },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 }, // price at purchase time, never recomputed from current Product
    compareAtPrice: { type: Number },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const addressSchema = new Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: "" },
    ward: { type: String, default: "" },
    district: { type: String, default: "" },
    province: { type: String, required: true },
    country: { type: String, default: "Việt Nam" },
    postalCode: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },

    customer: {
      customerId: { type: Schema.Types.ObjectId, ref: "Customer" }, // nullable for guest checkout
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true },
    },

    shippingAddress: { type: addressSchema, required: true },
    billingAddress: { type: addressSchema },

    items: {
      type: [orderItemSchema],
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length > 0,
        message: "Đơn hàng phải có ít nhất một sản phẩm",
      },
    },

    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0, default: 0 },
    discountTotal: { type: Number, required: true, min: 0, default: 0 },
    couponCode: { type: String, default: "" },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "VND" },

    customerNote: { type: String, default: "" },

    // VietQR bank transfer is the only storefront payment method.
    paymentMethod: { type: String, enum: ["bank_transfer"], default: "bank_transfer" },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },

    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "processing", "completed", "cancelled"],
      default: "pending",
      index: true,
    },

    shippingStatus: {
      type: String,
      enum: ["unfulfilled", "processing", "shipped", "delivered", "returned"],
      default: "unfulfilled",
      index: true,
    },
    shippingCarrier: { type: String, default: "" },
    trackingNumber: { type: String, default: "" },

    inventoryReleased: { type: Boolean, default: false }, // true once stock was returned for a cancelled order
    // Coupon usage is counted at checkout, so an unpaid/cancelled order has to
    // give that use back. Flagged separately from stock so neither can run twice.
    couponUsageReleased: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type Order = InferSchemaType<typeof orderSchema> & { _id: Types.ObjectId };
export const OrderModel = model("Order", orderSchema);
