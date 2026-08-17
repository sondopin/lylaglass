import { Router, raw } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "@/middlewares/validate";
import { requireAdmin } from "@/middlewares/adminAuth";
import { listBankTransactionsQuerySchema } from "@/validators/payment.validators";
import { receiveBankWebhook, listAdminBankTransactions } from "@/controllers/payment.controller";

const router = Router();

// The provider retries failed deliveries (SePay: up to 7 times over 5 hours),
// so this needs its own generous budget instead of the storefront's.
const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// Raw body (not JSON-parsed) is required here so the provider's HMAC signature
// can be verified against the exact bytes it signed.
router.post("/bank-webhook", webhookLimiter, raw({ type: "*/*", limit: "256kb" }), receiveBankWebhook);

// Reconciliation view: every incoming transfer we were notified about, including
// ones that matched no order or were rejected for a wrong amount.
router.get(
  "/admin/bank-transactions",
  requireAdmin,
  validate({ query: listBankTransactionsQuerySchema }),
  listAdminBankTransactions
);

export default router;
