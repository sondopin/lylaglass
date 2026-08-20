import { Router } from "express";
import { validate } from "@/middlewares/validate";
import { requireAdmin } from "@/middlewares/adminAuth";
import { adminLoginSchema } from "@/validators/auth.validators";
import { adminLogin, adminLogout, getCurrentAdmin } from "@/controllers/auth.controller";

const router = Router();

router.post("/login", validate({ body: adminLoginSchema }), adminLogin);
// Not CSRF-gated: there is no session yet to derive a token from, and the
// worst a forged call here achieves is logging the victim's browser out
// (an annoyance, not a privilege or data compromise) — the standard
// justification for excluding logout from CSRF protection.
router.post("/logout", adminLogout);
router.get("/me", requireAdmin, getCurrentAdmin);

export default router;
