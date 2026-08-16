import { Router } from "express";
import { requireAdmin, requireRole } from "@/middlewares/adminAuth";
import { getSettings, updateSettings } from "@/controllers/settings.controller";

const router = Router();

router.get("/", getSettings);
router.patch("/", requireAdmin, requireRole("owner"), updateSettings);

export default router;
