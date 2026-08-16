import { Router, raw } from "express";
import { receivePaymentWebhook } from "@/controllers/payment.controller";

const router = Router();

// Raw body (not JSON-parsed) is required here so the payment provider's
// signature can be verified against the exact bytes it signed.
router.post("/webhook", raw({ type: "application/json" }), receivePaymentWebhook);

export default router;
