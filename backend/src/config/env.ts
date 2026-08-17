import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:4000",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",

  mongodbUri: required("MONGODB_URI", "mongodb://localhost:27017/lylaglass"),

  jwtSecret: required("JWT_SECRET", "dev-only-insecure-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  adminSeedEmail: process.env.ADMIN_SEED_EMAIL ?? "admin@lylaglass.vn",
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD ?? "ChangeMe123!",

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },

  payment: {
    // Only one storefront payment method exists: VietQR bank transfer to the shop's TPBank account.
    provider: (process.env.PAYMENT_PROVIDER ?? "vietqr") as "vietqr",
    /** Server-side lifetime of a payment, counted from Payment.createdAt. */
    ttlMinutes: Number(process.env.PAYMENT_TTL_MINUTES ?? 15),
    /** How often the background job expires timed-out payments and retries failed emails. */
    expirySweepIntervalMs: Number(process.env.PAYMENT_EXPIRY_SWEEP_INTERVAL_MS ?? 60_000),

    vietqr: {
      /** NAPAS BIN encoded into the QR (TPBank = 970423). Not the same thing as the short code. */
      bankBin: process.env.VIETQR_BANK_BIN ?? "970423",
      /** Short bank code, display/logo only (TPBank = TPB). */
      bankCode: process.env.VIETQR_BANK_CODE ?? "TPB",
      bankName: process.env.VIETQR_BANK_NAME ?? "TPBank",
      accountNumber: process.env.VIETQR_ACCOUNT_NUMBER ?? "",
      accountName: process.env.VIETQR_ACCOUNT_NAME ?? "",
    },

    /** Incoming-transfer notification provider — a separate concern from QR generation. */
    bankWebhook: {
      provider: (process.env.BANK_WEBHOOK_PROVIDER ?? "sepay") as "sepay",
      authMode: (process.env.BANK_WEBHOOK_AUTH_MODE ?? "hmac") as "hmac" | "apikey",
      /** HMAC-SHA256 shared secret (BANK_WEBHOOK_AUTH_MODE=hmac). */
      secret: process.env.BANK_WEBHOOK_SECRET ?? "",
      /** API key SePay sends as `Authorization: Apikey <key>` (BANK_WEBHOOK_AUTH_MODE=apikey). */
      apiKey: process.env.BANK_WEBHOOK_API_KEY ?? "",
      /** Replay window for HMAC-signed requests. */
      timestampToleranceSeconds: Number(process.env.BANK_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS ?? 300),
    },
  },

  email: {
    provider: (process.env.EMAIL_PROVIDER ?? "log") as "resend" | "log",
    apiKey: process.env.EMAIL_API_KEY ?? "",
    from: process.env.EMAIL_FROM ?? "LylaGlass <no-reply@lylaglass.vn>",
    replyTo: process.env.EMAIL_REPLY_TO ?? "",
    /** Confirmation emails stop being retried after this many failed attempts. */
    maxAttempts: Number(process.env.EMAIL_MAX_ATTEMPTS ?? 3),
    /**
     * Shop-side recipients of the "new paid order" alert (comma-separated).
     * Empty disables the alert entirely — the customer's confirmation is
     * unaffected either way.
     */
    orderNotificationRecipients: (process.env.ORDER_NOTIFICATION_EMAILS ?? "")
      .split(",")
      .map((address) => address.trim())
      .filter(Boolean),
  },

  /** Public storefront base URL, used to build order-lookup links inside emails. */
  storefrontUrl: process.env.STOREFRONT_URL ?? process.env.CLIENT_ORIGIN ?? "http://localhost:3000",

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900_000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  },

  isProduction: process.env.NODE_ENV === "production",
};
