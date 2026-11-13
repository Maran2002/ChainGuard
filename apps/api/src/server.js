import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { connectDatabase } from "./config/database.js";
import mongoose from "mongoose";

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, `${env.APP_NAME} API listening`);
  void connectDatabase();
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  });
}
