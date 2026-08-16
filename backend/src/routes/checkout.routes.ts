import { Router } from "express";
import { validate } from "@/middlewares/validate";
import { createCheckoutSchema } from "@/validators/order.validators";
import { createCheckout } from "@/controllers/checkout.controller";

const router = Router();

router.post("/", validate({ body: createCheckoutSchema }), createCheckout);

export default router;
