import { Router } from "express";
import { requireAdmin, requireRole } from "@/middlewares/adminAuth";
import { requireCsrf } from "@/middlewares/csrf";
import { getSettings, updateSettings } from "@/controllers/settings.controller";

const router = Router();

router.get("/", getSettings);
router.patch("/", requireAdmin, requireCsrf, requireRole("owner"), updateSettings);

export default router;
