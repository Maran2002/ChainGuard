import mongoose from "mongoose";
import { Transaction } from "../models/transaction.js";
import { connectDatabase } from "../config/database.js";

const apply = process.argv.includes("--apply");
const confirmed = process.argv.includes("--confirm-delete-all");
if (apply && !confirmed) {
  console.error("Refusing deletion without --confirm-delete-all");
  process.exitCode = 2;
} else {
  try {
    const connected = await connectDatabase();
    if (!connected) throw new Error("MongoDB is unavailable");
    const count = await Transaction.countDocuments({});
    if (!apply) {
      console.log(`DRY RUN: ${count} legacy shared transaction-cache records would be deleted`);
    } else {
      const result = await Transaction.deleteMany({});
      console.log(`DELETED: ${result.deletedCount} legacy shared transaction-cache records`);
    }
  } catch (error) {
    console.error(`FAILED: ${error.name || "CleanupError"}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
