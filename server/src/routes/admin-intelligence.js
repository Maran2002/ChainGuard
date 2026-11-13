import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { IntelligenceRecord } from "../models/intelligence-record.js";
import { AdminAuditLog } from "../models/admin-audit-log.js";
import { normalizeAddress } from "../config/chains.js";
import { adminIntelligenceListSchema } from "../validators/intelligence.js";
import { authenticate, requireRole } from "../services/auth-service.js";
import { requireDatabase } from "../middleware/require-database.js";
import { listIntelligence } from "../services/intelligence/directory-service.js";
import { httpError } from "../utils/http-error.js";

const sourceUrlSchema = z.string().url().max(1000).nullable().optional();
const createSchema = z.object({
  chain: z.enum(["TRON", "ETHEREUM", "BSC"]),
  address: z.string().trim().min(1).max(160),
  category: z.enum(["SANCTIONED", "FROZEN", "SCAM", "HACK", "PHISHING", "OTHER"]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  entityName: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().min(10).max(2000),
  sourceUrl: sourceUrlSchema,
  confidence: z.number().min(0).max(1).default(0.5),
  effectiveAt: z.string().datetime().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  confirmed: z.boolean().default(false),
}).strict();
const updateSchema = z.object({
  category: z.enum(["SANCTIONED", "FROZEN", "SCAM", "HACK", "PHISHING", "OTHER"]).optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  entityName: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).optional(),
  sourceUrl: sourceUrlSchema,
  confidence: z.number().min(0).max(1).optional(),
  effectiveAt: z.string().datetime().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  confirmed: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one record field is required");
function parseAdminQuery(req, _res, next) {
  const result = adminIntelligenceListSchema.safeParse(req.query);
  if (!result.success) return next(httpError(400, "VALIDATION_ERROR", "Intelligence filters are invalid"));
  req.validatedQuery = result.data;
  return next();
}

function parseBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const error = httpError(400, "VALIDATION_ERROR", "Intelligence record fields are invalid");
      error.details = result.error.issues.map(({ path, message }) => ({ path: path.join("."), message }));
      return next(error);
    }
    req.validatedBody = result.data;
    return next();
  };
}

function normalizeSourceUrl(value, existingUrl = null) {
  if (value == null || value === "") return null;
  const url = new URL(value);
  const unchangedLegacyHttp = url.protocol === "http:" && url.toString() === existingUrl;
  if (url.protocol !== "https:" && !unchangedLegacyHttp || url.username || url.password) throw httpError(400, "INVALID_SOURCE_URL", "Use a public HTTPS source URL without embedded credentials");
  return url.toString();
}

function recordById(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, "INTELLIGENCE_NOT_FOUND", "Intelligence record was not found");
  return IntelligenceRecord.findById(id);
}

async function markAuditFailed(audit, error) {
  await AdminAuditLog.updateOne({ _id: audit._id }, { $set: {
    status: "FAILED",
    safeErrorCode: error?.code === 11000 ? "DUPLICATE_INTELLIGENCE_RECORD" : "INTELLIGENCE_RECORD_UPDATE_FAILED",
    completedAt: new Date(),
  } });
}

export const adminIntelligenceRouter = Router();
adminIntelligenceRouter.use(requireDatabase, authenticate, requireRole("ADMIN"));

adminIntelligenceRouter.get("/", parseAdminQuery, async (req, res) => {
  const { items, meta } = await listIntelligence(req.validatedQuery);
  res.json({ success: true, data: items, meta, requestId: req.id });
});

adminIntelligenceRouter.post("/", parseBody(createSchema), async (req, res) => {
  const input = req.validatedBody;
  const normalized = normalizeAddress(input.chain, input.address);
  const sourceUrl = normalizeSourceUrl(input.sourceUrl);
  const audit = await AdminAuditLog.create({
    actorType: "USER", actorUserId: req.user.id, action: "INTELLIGENCE_RECORD_CREATED",
    targetType: "INTELLIGENCE_RECORD", targetId: "pending", sourceId: "manual-review", status: "STARTED", requestId: req.id,
    changedFields: Object.keys(input),
  });
  try {
    const record = await IntelligenceRecord.create({
      ...input, address: normalized.address, chain: normalized.chain,
      sourceId: "manual-review", sourceName: "ChainGuard manual review", sourceUrl,
      effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : null,
      lastSeenAt: null, ingestedAt: new Date(), isActive: true,
    });
    await AdminAuditLog.updateOne({ _id: audit._id }, { $set: { targetId: String(record._id), status: "SUCCEEDED", completedAt: new Date() } });
    return res.status(201).json({ success: true, data: { record }, requestId: req.id });
  } catch (error) {
    await markAuditFailed(audit, error);
    if (error?.code === 11000) throw httpError(409, "DUPLICATE_INTELLIGENCE_RECORD", "A manual record already exists for this wallet and category");
    throw error;
  }
});

adminIntelligenceRouter.patch("/:recordId", parseBody(updateSchema), async (req, res) => {
  const record = await recordById(req.params.recordId);
  if (!record) throw httpError(404, "INTELLIGENCE_NOT_FOUND", "Intelligence record was not found");
  const input = req.validatedBody;
  const changes = {};
  for (const [key, value] of Object.entries(input)) {
    const normalized = key === "sourceUrl" ? normalizeSourceUrl(value, record.sourceUrl) : key === "effectiveAt" ? (value ? new Date(value) : null) : value;
    const current = record[key];
    const equal = Array.isArray(normalized) ? JSON.stringify(normalized) === JSON.stringify(current || []) : String(normalized ?? "") === String(current ?? "");
    if (!equal) changes[key] = normalized;
  }
  if (Object.keys(changes).length === 0) return res.json({ success: true, data: { record }, requestId: req.id });
  const action = changes.isActive === false ? "INTELLIGENCE_RECORD_DEACTIVATED" : "INTELLIGENCE_RECORD_UPDATED";
  const audit = await AdminAuditLog.create({
    actorType: "USER", actorUserId: req.user.id, action, targetType: "INTELLIGENCE_RECORD", targetId: String(record._id),
    sourceId: record.sourceId, status: "STARTED", requestId: req.id, changedFields: Object.keys(changes),
  });
  try {
    Object.assign(record, changes);
    await record.save();
    await AdminAuditLog.updateOne({ _id: audit._id }, { $set: { status: "SUCCEEDED", completedAt: new Date() } });
    return res.json({ success: true, data: { record }, requestId: req.id });
  } catch (error) {
    await markAuditFailed(audit, error);
    throw error;
  }
});
