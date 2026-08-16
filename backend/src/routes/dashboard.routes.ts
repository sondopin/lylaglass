import { Router } from "express";
import { requireAdmin } from "@/middlewares/adminAuth";
import { getDashboard } from "@/controllers/dashboard.controller";

const router = Router();

router.get("/", requireAdmin, getDashboard);

export default router;
