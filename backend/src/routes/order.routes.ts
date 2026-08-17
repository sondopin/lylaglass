import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "@/middlewares/validate";
import { requireAdmin } from "@/middlewares/adminAuth";
import { lookupOrderQuerySchema, updateOrderStatusSchema, listOrdersQuerySchema } from "@/validators/order.validators";
import { paymentStatusQuerySchema } from "@/validators/payment.validators";
import {
  lookupOrder,
  getOrderPaymentStatus,
  listAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
  cancelAdminOrder,
} from "@/controllers/order.controller";

const router = Router();

router.get("/lookup/:orderNumber", validate({ query: lookupOrderQuerySchema }), lookupOrder);

/**
 * Polled by the storefront while a customer is paying, so it is exempt from the
 * global storefront budget (a 15-minute payment window at a 3s interval would
 * exhaust it) and gets a dedicated per-minute allowance instead.
 */
const paymentStatusLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// Guest access is granted by order number + the email used at checkout; there
// is no customer login.
router.get(
  "/:orderNumber/payment-status",
  paymentStatusLimiter,
  validate({ query: paymentStatusQuerySchema }),
  getOrderPaymentStatus
);

router.get("/admin/all", requireAdmin, validate({ query: listOrdersQuerySchema }), listAdminOrders);
router.get("/admin/:id", requireAdmin, getAdminOrderById);
router.patch("/admin/:id/status", requireAdmin, validate({ body: updateOrderStatusSchema }), updateAdminOrderStatus);
router.post("/admin/:id/cancel", requireAdmin, cancelAdminOrder);

export default router;
