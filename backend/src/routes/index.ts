import { Router } from "express";
import categoryRoutes from "./category.routes";
import productRoutes from "./product.routes";
import checkoutRoutes from "./checkout.routes";
import orderRoutes from "./order.routes";
import authRoutes from "./auth.routes";
import couponRoutes from "./coupon.routes";
import customerRoutes from "./customer.routes";
import dashboardRoutes from "./dashboard.routes";
import settingsRoutes from "./settings.routes";

const router = Router();

router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/orders", orderRoutes);
// /payments/webhook is mounted separately in app.ts, ahead of express.json(),
// so it can access the raw request body for signature verification.
router.use("/admin/auth", authRoutes);
router.use("/coupons", couponRoutes);
router.use("/customers", customerRoutes);
router.use("/admin/dashboard", dashboardRoutes);
router.use("/settings", settingsRoutes);

export default router;
