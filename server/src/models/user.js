import mongoose from "mongoose";

const userPreferencesSchema = new mongoose.Schema({
  defaultChain: { type: String, enum: ["TRON", "ETHEREUM", "BSC"], default: "TRON" },
  defaultInvestigationDepth: { type: Number, enum: [1, 2], default: 1 },
}, { _id: false, strict: true });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  username: { type: String, trim: true, lowercase: true, minlength: 3, maxlength: 50, default: undefined },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["USER", "ADMIN"], default: "USER", required: true },
  status: { type: String, enum: ["NOT_VERIFIED", "VERIFIED", "ACTIVE", "SUSPENDED"], default: "NOT_VERIFIED", required: true },
  emailVerifiedAt: { type: Date, default: null },
  emailVerificationTokenHash: { type: String, select: false, default: null },
  emailVerificationExpiresAt: { type: Date, select: false, default: null },
  emailVerificationLastSentAt: { type: Date, select: false, default: null },
  passwordResetTokenHash: { type: String, select: false, default: null },
  passwordResetExpiresAt: { type: Date, select: false, default: null },
  passwordResetLastSentAt: { type: Date, select: false, default: null },
  lastLoginAt: { type: Date, default: null },
  preferences: { type: userPreferencesSchema, default: () => ({}) },
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret) {
      delete ret.passwordHash;
      delete ret.emailVerificationTokenHash;
      delete ret.emailVerificationExpiresAt;
      delete ret.emailVerificationLastSentAt;
      delete ret.passwordResetTokenHash;
      delete ret.passwordResetExpiresAt;
      delete ret.passwordResetLastSentAt;
      delete ret.__v;
      return ret;
    },
  },
});

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true, sparse: true });

export const User = mongoose.models.User || mongoose.model("User", userSchema);
