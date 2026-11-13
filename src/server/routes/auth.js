import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RefreshSession } from "../models/refresh-session.js";
import mongoose from "mongoose";
import { authenticate, changePassword, clearAuthCookies, deleteOwnAccount, getCurrentUser, login, logout, refresh, register, resendEmailVerification, requestPasswordReset, verifyEmailAddress, validatePasswordResetToken, resetPassword } from "../services/auth-service.js";
import { requireDatabase } from "../middleware/require-database.js";
import { accountDeletionSchema, actionTokenSchema, emailOnlySchema, loginSchema, parseBody, passwordChangeSchema, passwordResetSchema, preferencesUpdateSchema, profileUpdateSchema, registerSchema } from "../validators/auth.js";
import { httpError } from "../utils/http-error.js";
import { productionRateLimitStore } from "../middleware/mongo-rate-limit-store.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  store: productionRateLimitStore("auth"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler(_req, res) {
    res.status(429).json({ success: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait and try again." }, requestId: res.getHeader("X-Request-ID") });
  },
});

const emailActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  store: productionRateLimitStore("email-actions"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler(_req, res) {
    res.status(429).json({ success: false, error: { code: "RATE_LIMITED", message: "Too many email security requests. Please wait before trying again." }, requestId: res.getHeader("X-Request-ID") });
  },
});

authRouter.post("/register", requireDatabase, authLimiter, parseBody(registerSchema), async (req, res) => {
  const result = await register(req.validatedBody);
  res.status(201).json({ success: true, data: result, requestId: req.id });
});

authRouter.post("/login", requireDatabase, authLimiter, parseBody(loginSchema), async (req, res) => {
  const user = await login(req.validatedBody, req, res);
  res.json({ success: true, data: { user }, requestId: req.id });
});

authRouter.post("/verify-email", requireDatabase, emailActionLimiter, parseBody(actionTokenSchema), async (req, res) => {
  const user = await verifyEmailAddress(req.validatedBody.token);
  res.json({ success: true, data: { user }, requestId: req.id });
});

authRouter.post("/email/verification/resend", requireDatabase, emailActionLimiter, parseBody(emailOnlySchema), async (req, res) => {
  await resendEmailVerification(req.validatedBody.email);
  res.json({ success: true, data: { accepted: true }, requestId: req.id });
});

authRouter.post("/password/forgot", requireDatabase, emailActionLimiter, parseBody(emailOnlySchema), async (req, res) => {
  await requestPasswordReset(req.validatedBody.email);
  res.json({ success: true, data: { accepted: true }, requestId: req.id });
});

authRouter.post("/password/reset/verify", requireDatabase, emailActionLimiter, parseBody(actionTokenSchema), async (req, res) => {
  const result = await validatePasswordResetToken(req.validatedBody.token);
  res.json({ success: true, data: result, requestId: req.id });
});

authRouter.post("/password/reset", requireDatabase, emailActionLimiter, parseBody(passwordResetSchema), async (req, res) => {
  const user = await resetPassword(req.validatedBody);
  clearAuthCookies(res);
  res.json({ success: true, data: { user, passwordReset: true }, requestId: req.id });
});

authRouter.post("/refresh", requireDatabase, authLimiter, async (req, res) => {
  const user = await refresh(req, res);
  res.json({ success: true, data: { user }, requestId: req.id });
});

authRouter.post("/logout", async (req, res) => {
  const outcome = await logout(req, res);
  res.json({ success: true, data: { loggedOut: true, revocationConfirmed: outcome.revoked }, requestId: req.id });
});

authRouter.get("/me", requireDatabase, authenticate, (req, res) => {
  res.json({ success: true, data: { user: getCurrentUser(req) }, requestId: req.id });
});

authRouter.patch("/me", requireDatabase, authenticate, parseBody(profileUpdateSchema), async (req, res) => {
  req.user.name = req.validatedBody.name;
  await req.user.save();
  res.json({ success: true, data: { user: getCurrentUser(req) }, requestId: req.id });
});

authRouter.patch("/preferences", requireDatabase, authenticate, parseBody(preferencesUpdateSchema), async (req, res) => {
  req.user.preferences = req.validatedBody;
  await req.user.save();
  res.json({ success: true, data: { user: getCurrentUser(req) }, requestId: req.id });
});

authRouter.patch("/password", requireDatabase, authenticate, parseBody(passwordChangeSchema), async (req, res) => {
  const user = await changePassword(req.validatedBody, req);
  res.json({ success: true, data: { user, otherSessionsRevoked: true }, requestId: req.id });
});

authRouter.delete("/me", requireDatabase, authenticate, parseBody(accountDeletionSchema), async (req, res) => {
  await deleteOwnAccount(req.validatedBody, req);
  clearAuthCookies(res);
  res.json({ success: true, data: { deleted: true }, requestId: req.id });
});

authRouter.get("/sessions", requireDatabase, authenticate, async (req, res) => {
  const sessions = await RefreshSession.find({ userId: req.user.id, revokedAt: null, expiresAt: { $gt: new Date() } })
    .select("userAgent createdAt expiresAt")
    .sort({ createdAt: -1, _id: -1 })
    .limit(20)
    .lean();
  res.json({ success: true, data: sessions.map((session) => ({
    id: session._id,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    current: String(session._id) === String(req.sessionId),
  })), requestId: req.id });
});

authRouter.delete("/sessions/:sessionId", requireDatabase, authenticate, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.sessionId)) throw httpError(404, "SESSION_NOT_FOUND", "Session was not found");
  const session = await RefreshSession.findOne({ _id: req.params.sessionId, userId: req.user.id, revokedAt: null, expiresAt: { $gt: new Date() } }).select("_id").lean();
  if (!session) throw httpError(404, "SESSION_NOT_FOUND", "Active session was not found");
  const revokedAt = new Date();
  const outcome = await RefreshSession.updateOne({ _id: session._id, userId: req.user.id, revokedAt: null }, { $set: { revokedAt } });
  if (outcome.modifiedCount !== 1) throw httpError(409, "SESSION_ALREADY_REVOKED", "This session is no longer active");
  const current = String(session._id) === String(req.sessionId);
  if (current) clearAuthCookies(res);
  res.json({ success: true, data: { revoked: true, current }, requestId: req.id });
});

authRouter.post("/logout-all", requireDatabase, authenticate, async (req, res) => {
  await RefreshSession.updateMany({ userId: req.user.id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  clearAuthCookies(res);
  res.json({ success: true, data: { loggedOut: true }, requestId: req.id });
});
