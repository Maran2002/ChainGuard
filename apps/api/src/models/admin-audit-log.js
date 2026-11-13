import mongoose from "mongoose";

const countsSchema = new mongoose.Schema({
  fetched: { type: Number, default: 0 },
  created: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  deactivated: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
}, { _id: false, strict: true });

const adminAuditLogSchema = new mongoose.Schema({
  actorType: { type: String, enum: ["USER", "SYSTEM"], required: true },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  action: { type: String, enum: ["ADMIN_ACCOUNT_BOOTSTRAPPED", "INGESTION_RUN", "USER_ACCESS_UPDATED", "INTELLIGENCE_RECORD_CREATED", "INTELLIGENCE_RECORD_UPDATED", "INTELLIGENCE_RECORD_DEACTIVATED"], required: true },
  targetType: { type: String, required: true, maxlength: 80 },
  targetId: { type: String, required: true, maxlength: 120 },
  sourceId: { type: String, default: null, maxlength: 80 },
  jobId: { type: String, default: null, maxlength: 80 },
  dryRun: { type: Boolean, default: null },
  status: { type: String, enum: ["STARTED", "SUCCEEDED", "PARTIAL", "FAILED", "DRY_RUN"], required: true },
  counts: { type: countsSchema, default: null },
  accessChange: {
    previousRole: { type: String, enum: ["USER", "ADMIN"], default: null },
    newRole: { type: String, enum: ["USER", "ADMIN"], default: null },
    previousStatus: { type: String, enum: ["NOT_VERIFIED", "VERIFIED", "ACTIVE", "SUSPENDED"], default: null },
    newStatus: { type: String, enum: ["NOT_VERIFIED", "VERIFIED", "ACTIVE", "SUSPENDED"], default: null },
  },
  changedFields: { type: [String], default: [] },
  safeErrorCode: { type: String, default: null, maxlength: 80 },
  requestId: { type: String, default: null, maxlength: 80 },
  occurredAt: { type: Date, required: true, default: Date.now },
  completedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false, collection: "admin_audit_logs" });

adminAuditLogSchema.index({ occurredAt: -1 });
adminAuditLogSchema.index({ action: 1, occurredAt: -1 });

export const AdminAuditLog = mongoose.models.AdminAuditLog || mongoose.model("AdminAuditLog", adminAuditLogSchema, "admin_audit_logs");
