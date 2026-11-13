import "../config/env.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { connectDatabase } from "../config/database.js";
import { AdminAuditLog } from "../models/admin-audit-log.js";
import { User } from "../models/user.js";

const adminPassword = process.env.CHAINGUARD_ADMIN_PASSWORD;

async function ensureCollection(model) {
  const collectionName = model.collection.collectionName;
  const exists = await mongoose.connection.db.listCollections({ name: collectionName }, { nameOnly: true }).hasNext();
  if (!exists) await model.createCollection();
  await model.createIndexes();
}

try {
  if (!adminPassword) throw new Error("ADMIN_PASSWORD_REQUIRED");
  if (!(await connectDatabase())) throw new Error("DATABASE_UNAVAILABLE");

  await ensureCollection(User);
  await ensureCollection(AdminAuditLog);

  const existing = await User.findOne({ $or: [{ username: "admin" }, { email: "admin@chainguard.local" }] }).select("username email role").lean();
  if (existing) {
    process.stdout.write(`Admin account already exists (${existing.username || existing.email}); left unchanged.\n`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, env.BCRYPT_ROUNDS);
    const user = await User.create({
      name: "ChainGuard Admin",
      username: "admin",
      email: "admin@chainguard.local",
      passwordHash,
      role: "ADMIN",
      status: "VERIFIED",
    });
    await AdminAuditLog.create({
      actorType: "SYSTEM",
      action: "ADMIN_ACCOUNT_BOOTSTRAPPED",
      targetType: "USER",
      targetId: user.id,
      status: "SUCCEEDED",
      occurredAt: new Date(),
      completedAt: new Date(),
    });
    process.stdout.write("Admin account created. Sign in with username admin. The password was not displayed.\n");
  }
} catch (error) {
  process.stderr.write(`${error.message === "ADMIN_PASSWORD_REQUIRED" ? "Set CHAINGUARD_ADMIN_PASSWORD in the process environment and retry." : error.message === "DATABASE_UNAVAILABLE" ? "MongoDB connection failed; no admin account was created." : "Admin bootstrap failed. No password or connection details were logged."}\n`);
  process.exitCode = 1;
} finally {
  delete process.env.CHAINGUARD_ADMIN_PASSWORD;
  await mongoose.disconnect();
}
