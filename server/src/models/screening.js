import mongoose from "mongoose";

const factorSchema = new mongoose.Schema({
  name: String,
  kind: String,
  score: Number,
  weight: Number,
  source: String,
  sourceId: String,
  confidence: Number,
  explanation: String,
  timestamp: mongoose.Schema.Types.Mixed,
  category: String,
  confirmed: Boolean,
  distance: Number,
  counterpartyAddress: String,
  recordId: String,
  sourceUrl: String,
  dataLabel: String,
}, { _id: false, strict: true });

const transactionSnapshotSchema = new mongoose.Schema({
  chain: String,
  transactionHash: String,
  eventIndex: Number,
  fromAddress: String,
  toAddress: String,
  assetId: String,
  symbol: String,
  amount: String,
  valueUsd: Number,
  blockTimestamp: Date,
  providerStatus: { type: String, enum: ["LIVE", "MOCK"] },
  dataLabel: { type: String, enum: ["LIVE_SOURCE", "SIMULATED_FIXTURE"] },
}, { _id: false, strict: true });

const screeningSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  chain: { type: String, enum: ["TRON", "ETHEREUM", "BSC"], required: true },
  address: { type: String, required: true, trim: true, lowercase: true },
  transactionHash: { type: String, trim: true, lowercase: true, default: null },
  investigationDepth: { type: Number, enum: [1, 2], default: 1 },
  transactionDataTruncated: { type: Boolean, default: false },
  transactionSnapshot: {
    type: [transactionSnapshotSchema], default: undefined, select: false,
    validate: { validator: (rows) => rows == null || rows.length <= 500, message: "Transaction snapshot exceeds 500 transfers" },
  },
  verdict: { type: String, enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"], required: true },
  riskScore: { type: Number, min: 0, max: 100, default: null },
  riskFactors: { type: [factorSchema], default: [] },
  matchedRecords: { type: [factorSchema], default: [] },
  exposureSummary: { findings: { type: Number, default: 0 }, maxDistance: { type: Number, default: 0 }, truncated: { type: Boolean, default: false } },
  behaviorSummary: { findings: { type: Number, default: 0 } },
  coverage: { type: mongoose.Schema.Types.Mixed, required: true },
  providerStatus: { type: String, enum: ["LIVE", "MOCK", "UNAVAILABLE"], required: true },
  screenedAt: { type: Date, required: true, default: Date.now },
  durationMs: { type: Number, min: 0, required: true },
  riskModelVersion: { type: String, required: true },
  recommendedAction: { type: String, required: true },
}, { timestamps: true, versionKey: false });

screeningSchema.index({ userId: 1, screenedAt: -1 });
screeningSchema.index({ chain: 1, address: 1, screenedAt: -1 });
screeningSchema.index({ userId: 1, verdict: 1, screenedAt: -1 });

export const Screening = mongoose.models.Screening || mongoose.model("Screening", screeningSchema);
