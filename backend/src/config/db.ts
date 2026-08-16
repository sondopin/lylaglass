import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => {
    logger.info("MongoDB connected");
  });
  mongoose.connection.on("error", (err) => {
    logger.error({ err }, "MongoDB connection error");
  });

  await mongoose.connect(env.mongodbUri);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
