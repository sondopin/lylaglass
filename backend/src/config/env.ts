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

  /**
   * Default targets the local single-node replica set from docker-compose.
   * `directConnection=true` is required from the host: the replica set is
   * configured with the member host `mongo:27017`, which only resolves inside
   * the Docker network, so topology discovery has to be bypassed.
   */
  mongodbUri: required("MONGODB_URI", "mongodb://localhost:27017/lylaglass?replicaSet=rs0&directConnection=true"),

  mongo: {
    /** Atlas M0 caps the whole cluster at 500 connections — stay well under it. */
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE ?? 10),
    serverSelectionTimeoutMs: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 10_000),
    socketTimeoutMs: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS ?? 45_000),
    /**
     * Refuse to serve production traffic against a deployment that cannot run
     * transactions. Set to false only for a deliberate, documented exception.
     */
    requireTransactions: (process.env.MONGODB_REQUIRE_TRANSACTIONS ?? "true") !== "false",
  },

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
    provider: (process.env.EMAIL_PROVIDER ?? "log") as "gmail" | "log",
    from: process.env.EMAIL_FROM ?? "LylaGlass <no-reply@lylaglass.vn>",
    replyTo: process.env.EMAIL_REPLY_TO ?? "",

    /**
     * Gmail API, OAuth2 refresh-token flow (installed-app credentials).
     *
     * The refresh token is issued once, offline, for the mailbox that will send
     * the mail; the server exchanges it for short-lived access tokens. No
     * password and no app-specific password is ever stored, and revoking access
     * in the Google account immediately stops the server sending.
     */
    gmail: {
      clientId: process.env.GMAIL_CLIENT_ID ?? "",
      clientSecret: process.env.GMAIL_CLIENT_SECRET ?? "",
      refreshToken: process.env.GMAIL_REFRESH_TOKEN ?? "",
      /**
       * The mailbox the refresh token belongs to. Gmail rejects a `From:` that
       * is neither this address nor one of its verified send-as aliases.
       */
      sender: process.env.GMAIL_SENDER ?? "",
    },
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
