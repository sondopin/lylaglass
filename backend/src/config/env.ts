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
    provider: (process.env.PAYMENT_PROVIDER ?? "mock") as "mock" | "stripe",
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900_000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  },

  isProduction: process.env.NODE_ENV === "production",
};
