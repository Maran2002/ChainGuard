import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { User } from "../models/user.js";
import { AdminAuditLog } from "../models/admin-audit-log.js";
import { authenticate, requireRole } from "../services/auth-service.js";
import { requireDatabase } from "../middleware/require-database.js";
import { httpError } from "../utils/http-error.js";

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  status: z.enum(["NOT_VERIFIED", "VERIFIED", "SUSPENDED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
const updateSchema = z.object({ role: z.enum(["USER", "ADMIN"]).optional(), status: z.enum(["NOT_VERIFIED", "VERIFIED", "SUSPENDED"]).optional() })
  .strict().refine((value) => Object.keys(value).length > 0, "At least one access field is required");

function parseQuery(req, _res, next) {
  const result = listSchema.safeParse(req.query);
  if (!result.success) return next(httpError(400, "VALIDATION_ERROR", "User list filters are invalid"));
  req.validatedQuery = result.data;
  return next();
}

function safeUser(user) {
  return { id: user._id, name: user.name, username: user.username || null, email: user.email, role: user.role, status: user.status === "ACTIVE" ? "VERIFIED" : user.status, lastLoginAt: user.lastLoginAt, createdAt: user.createdAt };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const adminUsersRouter = Router();
adminUsersRouter.use(requireDatabase, authenticate, requireRole("ADMIN"));

adminUsersRouter.get("/", parseQuery, async (req, res) => {
  const query = req.validatedQuery;
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.status === "VERIFIED") filter.status = { $in: ["VERIFIED", "ACTIVE"] };
  else if (query.status) filter.status = query.status;
  if (query.q) {
    const term = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: term }, { username: term }, { email: term }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).select("name username email role status lastLoginAt createdAt").sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: users.map(safeUser), meta: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) }, requestId: req.id });
});

adminUsersRouter.patch("/:userId", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) throw httpError(404, "USER_NOT_FOUND", "User was not found");
  const parsed = updateSchema.safeParse(req.body || {});
  if (!parsed.success) throw httpError(400, "VALIDATION_ERROR", "User access changes are invalid");
  if (String(req.params.userId) === String(req.user.id)) throw httpError(409, "SELF_ACCESS_CHANGE", "Administrators cannot change their own role or account status");

  const target = await User.findById(req.params.userId);
  if (!target) throw httpError(404, "USER_NOT_FOUND", "User was not found");
  const nextRole = parsed.data.role ?? target.role;
  const nextStatus = parsed.data.status ?? target.status;
  const nextStatusIsEnabled = nextStatus === "VERIFIED" || nextStatus === "ACTIVE";
  if (target.role === "ADMIN" && (nextRole !== "ADMIN" || !nextStatusIsEnabled)) {
    const enabledAdminCount = await User.countDocuments({ role: "ADMIN", status: { $in: ["VERIFIED", "ACTIVE"] } });
    if (enabledAdminCount <= 1) throw httpError(409, "LAST_ADMIN", "At least one enabled administrator must remain");
  }
  if (nextRole === target.role && nextStatus === target.status) {
    return res.json({ success: true, data: { user: safeUser(target) }, requestId: req.id });
  }

  const audit = await AdminAuditLog.create({
    actorType: "USER",
    actorUserId: req.user.id,
    action: "USER_ACCESS_UPDATED",
    targetType: "USER",
    targetId: String(target._id),
    status: "STARTED",
    requestId: req.id,
    accessChange: { previousRole: target.role, newRole: nextRole, previousStatus: target.status, newStatus: nextStatus },
  });
  try {
    target.role = nextRole;
    target.status = nextStatus;
    await target.save();
    await AdminAuditLog.updateOne({ _id: audit._id }, { $set: { status: "SUCCEEDED", completedAt: new Date() } });
  } catch (error) {
    await AdminAuditLog.updateOne({ _id: audit._id }, { $set: { status: "FAILED", safeErrorCode: "USER_ACCESS_UPDATE_FAILED", completedAt: new Date() } });
    throw error;
  }
  return res.json({ success: true, data: { user: safeUser(target) }, requestId: req.id });
});
