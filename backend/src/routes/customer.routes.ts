import { Router } from "express";
import { requireAdmin } from "@/middlewares/adminAuth";
import { listAdminCustomers, getAdminCustomerById } from "@/controllers/customer.controller";

const router = Router();

router.get("/admin/all", requireAdmin, listAdminCustomers);
router.get("/admin/:id", requireAdmin, getAdminCustomerById);

export default router;
