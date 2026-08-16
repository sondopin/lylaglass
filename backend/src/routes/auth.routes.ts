import { Router } from "express";
import { validate } from "@/middlewares/validate";
import { requireAdmin } from "@/middlewares/adminAuth";
import { adminLoginSchema } from "@/validators/auth.validators";
import { adminLogin, getCurrentAdmin } from "@/controllers/auth.controller";

const router = Router();

router.post("/login", validate({ body: adminLoginSchema }), adminLogin);
router.get("/me", requireAdmin, getCurrentAdmin);

export default router;
