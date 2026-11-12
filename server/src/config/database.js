import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export async function connectDatabase() {
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 2500 });
    logger.info("MongoDB connection established");
    return true;
  } catch (error) {
    logger.warn({ error: error.name }, "MongoDB is unavailable; API is running without persistence");
    return false;
  }
}
