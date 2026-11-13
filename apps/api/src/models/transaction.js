import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  chain: { type: String, enum: ["TRON", "ETHEREUM", "BSC"], required: true },
  transactionHash: { type: String, required: true, lowercase: true, maxlength: 66 },
  eventIndex: { type: Number, min: 0, max: 1000000, default: 0 },
  fromAddress: { type: String, required: true, lowercase: true, maxlength: 100 },
  toAddress: { type: String, required: true, lowercase: true, maxlength: 100 },
  assetId: { type: String, default: "native", maxlength: 160 },
  symbol: { type: String, default: "NATIVE", maxlength: 32 },
  amount: { type: String, required: true, maxlength: 100 },
  valueUsd: { type: Number, min: 0, default: null },
  blockTimestamp: { type: Date, default: null },
  providerStatus: { type: String, enum: ["LIVE", "MOCK"], required: true },
  dataLabel: { type: String, enum: ["LIVE_SOURCE", "SIMULATED_FIXTURE"], required: true },
}, { timestamps: true, versionKey: false });

transactionSchema.index({ chain: 1, transactionHash: 1, eventIndex: 1 }, { unique: true });
transactionSchema.index({ chain: 1, fromAddress: 1, blockTimestamp: -1 });
transactionSchema.index({ chain: 1, toAddress: 1, blockTimestamp: -1 });

export const Transaction = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);
