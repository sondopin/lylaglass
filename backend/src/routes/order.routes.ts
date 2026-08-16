import { Router } from "express";
import { validate } from "@/middlewares/validate";
import { requireAdmin } from "@/middlewares/adminAuth";
import { lookupOrderQuerySchema, updateOrderStatusSchema, listOrdersQuerySchema } from "@/validators/order.validators";
import {
  lookupOrder,
  listAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
  cancelAdminOrder,
} from "@/controllers/order.controller";

const router = Router();

router.get("/lookup/:orderNumber", validate({ query: lookupOrderQuerySchema }), lookupOrder);

router.get("/admin/all", requireAdmin, validate({ query: listOrdersQuerySchema }), listAdminOrders);
router.get("/admin/:id", requireAdmin, getAdminOrderById);
router.patch("/admin/:id/status", requireAdmin, validate({ body: updateOrderStatusSchema }), updateAdminOrderStatus);
router.post("/admin/:id/cancel", requireAdmin, cancelAdminOrder);

export default router;
