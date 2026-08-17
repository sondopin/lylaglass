import { z } from "zod";

export const addressInputSchema = z.object({
  fullName: z.string().min(1, "Họ tên là bắt buộc").max(150),
  phone: z
    .string()
    .min(9, "Số điện thoại không hợp lệ")
    .max(15)
    .regex(/^[0-9+\s()-]+$/, "Số điện thoại không hợp lệ"),
  line1: z.string().min(1, "Địa chỉ là bắt buộc").max(300),
  line2: z.string().max(300).optional(),
  ward: z.string().max(150).optional(),
  district: z.string().max(150).optional(),
  province: z.string().min(1, "Tỉnh/Thành phố là bắt buộc").max(150),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
});

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
});

export const createCheckoutSchema = z.object({
  customer: z.object({
    name: z.string().min(1, "Họ tên là bắt buộc").max(150),
    email: z.string().email("Email không hợp lệ"),
    phone: z
      .string()
      .min(9, "Số điện thoại không hợp lệ")
      .max(15)
      .regex(/^[0-9+\s()-]+$/, "Số điện thoại không hợp lệ"),
  }),
  shippingAddress: addressInputSchema,
  billingAddress: addressInputSchema.optional(),
  items: z.array(checkoutItemSchema).min(1, "Giỏ hàng đang trống"),
  couponCode: z.string().optional(),
  customerNote: z.string().max(1000).optional(),
  // VietQR bank transfer is the only method. Accepted for explicitness, but the
  // server sets the order's method itself — as it does the amount and totals.
  paymentMethod: z.literal("bank_transfer").default("bank_transfer"),
});

export const lookupOrderQuerySchema = z.object({
  email: z.string().email(),
});

export const updateOrderStatusSchema = z.object({
  orderStatus: z.enum(["pending", "confirmed", "processing", "completed", "cancelled"]).optional(),
  shippingStatus: z.enum(["unfulfilled", "processing", "shipped", "delivered", "returned"]).optional(),
  trackingNumber: z.string().max(120).optional(),
  shippingCarrier: z.string().max(120).optional(),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  orderStatus: z.string().optional(),
  paymentStatus: z.string().optional(),
  shippingStatus: z.string().optional(),
  q: z.string().optional(),
});
