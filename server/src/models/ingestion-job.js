import mongoose from "mongoose";

const ingestionJobSchema = new mongoose.Schema({
  sourceId: { type: String, required: true, index: true },
  sourceName: { type: String, required: true },
  status: { type: String, enum: ["RUNNING", "SUCCEEDED", "PARTIAL", "FAILED", "DRY_RUN"], required: true },
  dryRun: { type: Boolean, required: true },
  startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  startedAt: { type: Date, required: true, default: Date.now },
  completedAt: { type: Date, default: null },
  sourceGeneratedAt: { type: Date, default: null },
  durationMs: { type: Number, min: 0, default: null },
  counts: {
    fetched: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    deactivated: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  safeErrorCode: { type: String, maxlength: 80, default: null },
}, { timestamps: true, versionKey: false });

ingestionJobSchema.index({ sourceId: 1, startedAt: -1 });
ingestionJobSchema.index({ startedAt: -1 });

export const IngestionJob = mongoose.models.IngestionJob || mongoose.model("IngestionJob", ingestionJobSchema);
