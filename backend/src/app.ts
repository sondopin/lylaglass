import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import routes from "./routes";
import paymentRoutes from "./routes/payment.routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(pinoHttp({ logger, autoLogging: !env.isProduction }));

  // Routes that carry their own, differently-shaped rate limit: the bank
  // webhook (provider retries must not be throttled away) and the payment
  // status poll (long-lived, high-frequency by design).
  const SELF_LIMITED_PATHS = [/^\/api\/payments(\/|$)/, /^\/api\/orders\/[^/]+\/payment-status/];

  const limiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => SELF_LIMITED_PATHS.some((pattern) => pattern.test(req.originalUrl)),
  });
  app.use("/api", limiter);

  // Mounted before express.json() so the webhook handler still sees the
  // unparsed request stream — required to verify the provider's signature
  // against the exact raw bytes it signed.
  app.use("/api/payments", paymentRoutes);

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req, res) => res.json({ success: true, status: "ok" }));

  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
