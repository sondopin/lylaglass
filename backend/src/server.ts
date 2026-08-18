import { createApp } from "./app";
import { connectDatabase, ensureCriticalIndexes } from "./config/db";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { validateRuntimeConfig } from "./config/validateConfig";
import { startPaymentExpiryJob } from "./jobs/paymentExpiry.job";
// Imported for their side effect of registering every schema, so
// ensureCriticalIndexes() sees the full model list rather than only the models
// that happen to have been imported by a route already.
import "./models/AdminUser.model";
import "./models/BankTransaction.model";
import "./models/Category.model";
import "./models/Coupon.model";
import "./models/Customer.model";
import "./models/Order.model";
import "./models/Payment.model";
import "./models/Product.model";
import "./models/Review.model";
import "./models/Settings.model";

async function main() {
  validateRuntimeConfig();
  await connectDatabase();
  // Several unique indexes are the mechanism enforcing payment idempotency, so
  // the server must not accept traffic before they exist.
  await ensureCriticalIndexes();
  startPaymentExpiryJob();

  const app = createApp();
  app.listen(env.port, () => {
    logger.info(`LylaGlass API đang chạy tại ${env.apiBaseUrl} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  logger.error({ err }, "Không thể khởi động server");
  process.exit(1);
});
