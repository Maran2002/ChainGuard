import mongoose from "mongoose";

const refreshSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  userAgent: { type: String, maxlength: 300, default: null },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });

export const RefreshSession = mongoose.models.RefreshSession || mongoose.model("RefreshSession", refreshSessionSchema);
