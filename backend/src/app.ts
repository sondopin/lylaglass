import express, { RequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import routes from "./routes";
import paymentRoutes from "./routes/payment.routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

/**
 * Two separate CORS policies, dispatched by request Origin — **not** one
 * policy with a single static `credentials` flag applied to every whitelisted
 * origin.
 *
 * The `cors` package's `credentials` option is a single boolean for the whole
 * middleware instance, not something the `origin` callback can vary per
 * request. A first pass at this used one `cors()` call with both the
 * storefront and the admin app's origins in the same `credentials: true`
 * whitelist — which meant a `fetch(..., { credentials: "include" })` from
 * *storefront* JavaScript could read authenticated admin responses too,
 * confirmed live in a real browser: the cookie physically attaches to any
 * same-site request regardless of which page initiated it (that is normal,
 * unavoidable browser behaviour — see utils/csrf.ts for why CSRF protection,
 * not CORS, is what has to stop a *mutating* request), but a response must
 * still never be **readable** by a page whose origin has no business reading
 * it. Only the admin app is ever meant to send or receive this cookie, so it
 * is the only origin CORS credentials are enabled for.
 *
 * `credentialedCors` (origin === ADMIN_URL only): `Access-Control-Allow-
 * Credentials: true`, letting the admin app's fetches include and receive the
 * session cookie.
 * `publicCors` (any other whitelisted origin, e.g. the storefront): no
 * `Access-Control-Allow-Credentials` header at all. If such an origin's JS
 * ever attempts a credentialed request anyway, the browser still refuses to
 * expose the response — this is what actually closes the confidentiality
 * gap, not anything about *sending* the cookie.
 */
function corsMiddleware(): RequestHandler {
  const adminOrigin = env.adminUrl.replace(/\/$/, "");

  const credentialedCors = cors({
    origin(origin, callback) {
      if (origin === adminOrigin) return callback(null, true);
      callback(new Error(`Origin không được phép (credentialed): ${origin}`));
    },
    credentials: true,
  });

  const publicCors = cors({
    // A server-to-server caller (the SePay webhook, curl, Postman) sends no
    // `Origin` header at all, so it is exempt from this check entirely — CORS
    // is a browser-only mechanism and never applies to those requests.
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin không được phép: ${origin}`));
    },
    credentials: false,
  });

  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origin === adminOrigin) return credentialedCors(req, res, next);
    return publicCors(req, res, next);
  };
}

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(corsMiddleware());
  // Only reads `req.headers.cookie` into `req.cookies` — does not touch the
  // request body, so it is safe ahead of the raw-body webhook route below.
  app.use(cookieParser());
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
