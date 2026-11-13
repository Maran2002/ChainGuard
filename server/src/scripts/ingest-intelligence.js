import "../config/env.js";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { runIngestion } from "../services/intelligence/ingestion-service.js";

const args = process.argv.slice(2);
const sourceIndex = args.indexOf("--source");
const sourceId = sourceIndex >= 0
  ? args[sourceIndex + 1]
  : process.env.npm_config_source || args.find((argument) => !argument.startsWith("--")) || null;
const apply = args.includes("--apply") || process.env.npm_config_apply === "true";
const dryRun = !apply;

if (!sourceId || sourceId.startsWith("--") || (apply && args.includes("--dry-run")) || args.some((arg) => !["--source", sourceId, "--apply", "--dry-run"].includes(arg))) {
  process.stderr.write("Usage: npm run ingest -- --source <registered-source-id> [--dry-run|--apply]\n");
  process.exit(2);
}

const databaseConnected = await connectDatabase();
if (apply && !databaseConnected) {
  process.stderr.write("MongoDB is unavailable; ingestion was not applied.\n");
  process.exit(1);
}

try {
  const result = await runIngestion(sourceId, { dryRun });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.code || "INGESTION_FAILED"}: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
