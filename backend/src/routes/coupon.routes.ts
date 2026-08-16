import { Router } from "express";
import { validate } from "@/middlewares/validate";
import { requireAdmin } from "@/middlewares/adminAuth";
import { applyCouponSchema, createCouponSchema, updateCouponSchema } from "@/validators/coupon.validators";
import {
  validateCoupon,
  listAdminCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "@/controllers/coupon.controller";

const router = Router();

router.post("/validate", validate({ body: applyCouponSchema }), validateCoupon);

router.get("/admin/all", requireAdmin, listAdminCoupons);
router.post("/admin", requireAdmin, validate({ body: createCouponSchema }), createCoupon);
router.patch("/admin/:id", requireAdmin, validate({ body: updateCouponSchema }), updateCoupon);
router.delete("/admin/:id", requireAdmin, deleteCoupon);

export default router;
