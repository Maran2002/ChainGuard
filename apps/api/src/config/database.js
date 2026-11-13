import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

let pendingConnection;

async function openConnection() {
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 2500 });
    logger.info("MongoDB connection established");
    return true;
  } catch (error) {
    logger.warn({ error: error.name }, "MongoDB is unavailable; API is running without persistence");
    return false;
  }
}

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return true;

  pendingConnection ??= openConnection().finally(() => {
    pendingConnection = undefined;
  });
  return pendingConnection;
}

export default connectDatabase;
