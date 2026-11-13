import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../services/auth-service.js";
import { requireDatabase } from "../middleware/require-database.js";
import { getRegisteredIntelligenceSources, listIngestionJobs, runIngestion } from "../services/intelligence/ingestion-service.js";
import { httpError } from "../utils/http-error.js";
import { AdminAuditLog } from "../models/admin-audit-log.js";

const sourceIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/);
const runSchema = z.object({ dryRun: z.boolean().default(true) }).strict();

export const adminIngestionRouter = Router();
adminIngestionRouter.use(requireDatabase, authenticate, requireRole("ADMIN"));

adminIngestionRouter.get("/sources", (req, res) => {
  res.json({ success: true, data: getRegisteredIntelligenceSources(), requestId: req.id });
});

adminIngestionRouter.get("/jobs", async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const jobs = await listIngestionJobs(limit);
  res.json({ success: true, data: jobs, requestId: req.id });
});

adminIngestionRouter.get("/audit-logs", async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const entries = await AdminAuditLog.find().sort({ occurredAt: -1 }).limit(limit)
    .select("actorType action targetType targetId sourceId dryRun status counts accessChange changedFields safeErrorCode occurredAt completedAt")
    .lean();
  res.json({ success: true, data: entries, requestId: req.id });
});

adminIngestionRouter.post("/:sourceId/run", async (req, res) => {
  if (!sourceIdSchema.safeParse(req.params.sourceId).success) throw httpError(400, "VALIDATION_ERROR", "Source ID is invalid");
  const parsed = runSchema.safeParse(req.body || {});
  if (!parsed.success) throw httpError(400, "VALIDATION_ERROR", "Ingestion options are invalid");
  const audit = await AdminAuditLog.create({
    actorType: "USER",
    actorUserId: req.user.id,
    action: "INGESTION_RUN",
    targetType: "INTELLIGENCE_SOURCE",
    targetId: req.params.sourceId,
    sourceId: req.params.sourceId,
    dryRun: parsed.data.dryRun,
    status: "STARTED",
    requestId: req.id,
  });
  let result;
  try {
    result = await runIngestion(req.params.sourceId, { ...parsed.data, startedBy: req.user.id });
  } catch (error) {
    await AdminAuditLog.updateOne({ _id: audit._id }, { $set: { status: "FAILED", safeErrorCode: typeof error.code === "string" && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : "INGESTION_FAILED", completedAt: new Date() } });
    throw error;
  }
  await AdminAuditLog.updateOne({ _id: audit._id }, { $set: {
    jobId: result.jobId,
    status: result.status,
    counts: result.counts,
    completedAt: new Date(),
  } });
  res.status(202).json({ success: true, data: result, requestId: req.id });
});
