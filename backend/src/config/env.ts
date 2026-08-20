import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Converts a `jsonwebtoken`-style duration ("7d", "12h", "3600") to seconds,
 * for the cookie's `Max-Age`. Keeping the cookie's lifetime derived from the
 * same setting as the JWT's own expiry means they can never drift apart —
 * a cookie that outlives its token would just show a silently-broken session
 * once the JWT itself is rejected as expired.
 */
function parseExpiresIn(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60; // Falls back to 7 days on an unparseable value.
  const amount = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  const multiplier = { s: 1, m: 60, h: 3600, d: 86_400 }[unit] ?? 1;
  return amount * multiplier;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:4000",

  /**
   * Every browser origin allowed to call this API with credentials
   * (cookies): the storefront and the admin app, each its own entry — never a
   * wildcard suffix. `cors` reflects back only an origin found in this exact
   * list, which is what makes `Access-Control-Allow-Credentials: true` safe;
   * reflecting an unvalidated request Origin (or using `*`) would let any site
   * ride the admin cookie.
   *
   * Local dev default covers the storefront (3000) and frontend-admin (3001).
   */
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3001")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),

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
  /** Same expiry as the JWT, in seconds — governs the cookie's own `Max-Age`. */
  jwtExpiresInSeconds: parseExpiresIn(process.env.JWT_EXPIRES_IN ?? "7d"),
  adminSeedEmail: process.env.ADMIN_SEED_EMAIL ?? "admin@lylaglass.vn",
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD ?? "ChangeMe123!",

  adminCookie: {
    name: "admin_token",
    /**
     * Deliberately unset by default (host-only cookie): the admin JWT is then
     * scoped to exactly the host that issued it. Browsers attach a cookie
     * to a request based on the *target* host matching the cookie's domain,
     * not on which page's script initiated the request — so this still works
     * correctly when the admin app calls the API cross-origin (different
     * subdomain), as long as they share a registrable domain (SameSite=Lax
     * requires same-*site*, not same-*origin*).
     *
     * What host-only scoping actually buys: the storefront's own document
     * cannot read this cookie at all (`document.cookie` only ever exposes
     * cookies whose domain covers the *current* page), and setting it wider
     * (e.g. to the whole `.lylaglass.com`) would put it in reach of any XSS on
     * the storefront too. Only widen this if the API is deliberately meant to
     * share the cookie beyond the admin app — not the default posture here.
     */
    domain: process.env.ADMIN_COOKIE_DOMAIN ?? "",
  },

  /**
   * HMAC key the CSRF token is derived from. Deliberately separate from
   * JWT_SECRET: reusing one secret for two purposes means a future change to
   * one (key rotation, a different signing scheme) silently breaks the other.
   */
  csrfSecret: required("CSRF_SECRET", "dev-only-insecure-csrf-secret-change-me"),

  /**
   * Base URL of the admin app (its own origin, separate from the storefront),
   * used to build the "new paid order" email link the shop owner clicks.
   */
  adminUrl: process.env.ADMIN_URL ?? "http://localhost:3001",

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
  storefrontUrl: process.env.STOREFRONT_URL ?? "http://localhost:3000",

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900_000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  },

  isProduction: process.env.NODE_ENV === "production",
};
