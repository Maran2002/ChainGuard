import mongoose from "mongoose";

const intelligenceRecordSchema = new mongoose.Schema({
  address: { type: String, required: true, trim: true, lowercase: true },
  chain: { type: String, enum: ["TRON", "ETHEREUM", "BSC"], required: true },
  category: { type: String, enum: ["SANCTIONED", "FROZEN", "SCAM", "HACK", "PHISHING", "OTHER"], required: true },
  riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], required: true },
  entityName: { type: String, trim: true, maxlength: 200, default: null },
  sourceId: { type: String, required: true, trim: true, maxlength: 200 },
  sourceName: { type: String, required: true, trim: true, maxlength: 120 },
  sourceUrl: { type: String, trim: true, maxlength: 1000, default: null },
  description: { type: String, trim: true, maxlength: 2000, default: "" },
  confidence: { type: Number, min: 0, max: 1, default: 0.5 },
  effectiveAt: { type: Date, default: null },
  lastSeenAt: { type: Date, default: null },
  ingestedAt: { type: Date, default: Date.now },
  rawReference: { type: String, trim: true, maxlength: 300, default: null },
  tags: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
  confirmed: { type: Boolean, default: false },
}, { timestamps: true, versionKey: false });

intelligenceRecordSchema.index({ chain: 1, address: 1, isActive: 1 });
intelligenceRecordSchema.index({ chain: 1, address: 1, category: 1, sourceId: 1 }, { unique: true });
intelligenceRecordSchema.index({ category: 1, riskLevel: 1, ingestedAt: -1 });
intelligenceRecordSchema.index({ sourceId: 1, lastSeenAt: -1 });

export const IntelligenceRecord = mongoose.models.IntelligenceRecord || mongoose.model("IntelligenceRecord", intelligenceRecordSchema);
