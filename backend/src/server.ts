import { createApp } from "./app";
import { connectDatabase } from "./config/db";
import { env } from "./config/env";
import { logger } from "./config/logger";

async function main() {
  await connectDatabase();

  const app = createApp();
  app.listen(env.port, () => {
    logger.info(`LylaGlass API đang chạy tại ${env.apiBaseUrl} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  logger.error({ err }, "Không thể khởi động server");
  process.exit(1);
});
