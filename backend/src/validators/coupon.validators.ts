import { z } from "zod";

export const createCouponSchema = z.object({
  code: z.string().min(2).max(40),
  type: z.enum(["percentage", "fixed", "free_shipping"]),
  value: z.number().min(0),
  minimumSubtotal: z.number().min(0).optional(),
  maxDiscountAmount: z.number().min(0).optional(),
  usageLimit: z.number().int().min(1).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export const updateCouponSchema = createCouponSchema.partial();

export const applyCouponSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().min(0),
});
