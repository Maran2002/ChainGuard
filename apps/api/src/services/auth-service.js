import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { RefreshSession } from "../models/refresh-session.js";
import { User } from "../models/user.js";
import { Screening } from "../models/screening.js";
import { sendAccountActionEmail } from "./email/brevo-mailer.js";
import { logger } from "../utils/logger.js";
import { httpError } from "../utils/http-error.js";

const accessCookie = "cg_access";
const refreshCookie = "cg_refresh";
const jwtOptions = { issuer: env.APP_NAME, audience: "chainguard-client" };
const emailVerificationTtlMs = 24 * 60 * 60 * 1000;
const passwordResetTtlMs = 60 * 60 * 1000;
const emailActionCooldownMs = 60 * 1000;
const signInAllowedStatuses = ["VERIFIED", "ACTIVE"];

function durationMs(value) {
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(value);
  if (!match) throw new Error("JWT expiration must be a positive number followed by s, m, h, or d");
  const scales = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return Number(match[1]) * scales[match[2]];
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function emailActionUrl(path, token) {
  const appOrigin = env.CLIENT_ORIGIN.split(",")[0].trim().replace(/\/+$/, "");
  return `${appOrigin}/${path}#token=${encodeURIComponent(token)}`;
}

function logEmailFailure(flow, error) {
  logger.warn({ flow, code: error.code || "EMAIL_DELIVERY_FAILED" }, "Account security email was not sent");
}

async function issueEmailVerification(user) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  user.emailVerificationTokenHash = hashToken(token);
  user.emailVerificationExpiresAt = new Date(now.getTime() + emailVerificationTtlMs);
  user.emailVerificationLastSentAt = now;
  await user.save();
  try {
    await sendAccountActionEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      subject: "Verify your ChainGuard email",
      heading: "Confirm your email address",
      description: "Verify this email address to finish creating your ChainGuard account.",
      actionLabel: "Verify email",
      actionUrl: emailActionUrl("verify-email", token),
      expiryText: "24 hours",
    });
    return true;
  } catch (error) {
    logEmailFailure("email_verification", error);
    user.emailVerificationLastSentAt = null;
    await user.save();
    return false;
  }
}

async function issuePasswordReset(user) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpiresAt = new Date(now.getTime() + passwordResetTtlMs);
  user.passwordResetLastSentAt = now;
  await user.save();
  try {
    await sendAccountActionEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      subject: "Reset your ChainGuard password",
      heading: "Reset your password",
      description: "We received a request to change the password for your ChainGuard account.",
      actionLabel: "Choose a new password",
      actionUrl: emailActionUrl("reset-password", token),
      expiryText: "1 hour",
    });
    return true;
  } catch (error) {
    logEmailFailure("password_reset", error);
    user.passwordResetLastSentAt = null;
    await user.save();
    return false;
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: "/",
    maxAge,
  };
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(accessCookie, accessToken, cookieOptions(durationMs(env.JWT_ACCESS_EXPIRES_IN)));
  res.cookie(refreshCookie, refreshToken, cookieOptions(durationMs(env.JWT_REFRESH_EXPIRES_IN)));
}

export function clearAuthCookies(res) {
  const options = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAME_SITE, path: "/" };
  res.clearCookie(accessCookie, options);
  res.clearCookie(refreshCookie, options);
}

function signAccessToken(user, sessionId) {
  return jwt.sign({ type: "access", sid: sessionId }, env.JWT_ACCESS_SECRET, {
    ...jwtOptions,
    subject: user.id,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

function signRefreshToken(userId, sessionId) {
  return jwt.sign({ type: "refresh", sid: sessionId }, env.JWT_REFRESH_SECRET, {
    ...jwtOptions,
    subject: userId,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

async function issueSession(user, req, res) {
  const expiresAt = new Date(Date.now() + durationMs(env.JWT_REFRESH_EXPIRES_IN));
  const session = await RefreshSession.create({
    userId: user.id,
    tokenHash: "pending",
    expiresAt,
    userAgent: req.get("user-agent")?.slice(0, 300) || null,
  });
  const refreshToken = signRefreshToken(user.id, session.id);
  session.tokenHash = hashToken(refreshToken);
  await session.save();
  setAuthCookies(res, signAccessToken(user, session.id), refreshToken);
}

function publicUser(user) {
  return { id: user.id, name: user.name, username: user.username || null, email: user.email, role: user.role, status: user.status, preferences: user.preferences, createdAt: user.createdAt };
}

export async function register({ name, email, password }) {
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw httpError(400, "VALIDATION_ERROR", "Password must not exceed 72 UTF-8 bytes");
  }
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  let user;
  try {
    user = await User.create({ name, email: email.toLowerCase(), passwordHash, role: "USER", status: "NOT_VERIFIED" });
  } catch (error) {
    if (error?.code === 11000) throw httpError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
    throw error;
  }
  const verificationEmailSent = await issueEmailVerification(user);
  return { user: publicUser(user), verificationEmailSent };
}

export async function resendEmailVerification(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail, status: "NOT_VERIFIED" }).select("+emailVerificationLastSentAt");
  if (!user) return;
  const sentAt = user.emailVerificationLastSentAt?.getTime();
  if (sentAt && Date.now() - sentAt < emailActionCooldownMs) return;
  await issueEmailVerification(user);
}

export async function verifyEmailAddress(token) {
  const user = await User.findOneAndUpdate({
    emailVerificationTokenHash: hashToken(token),
    emailVerificationExpiresAt: { $gt: new Date() },
    status: "NOT_VERIFIED",
  }, {
    $set: { status: "VERIFIED", emailVerifiedAt: new Date() },
    $unset: { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1, emailVerificationLastSentAt: 1 },
  }, { new: true, runValidators: true });
  if (!user) throw httpError(400, "VERIFICATION_LINK_INVALID", "This verification link is invalid or expired. Request a new one and try again.");
  return publicUser(user);
}

export async function requestPasswordReset(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail, status: { $in: signInAllowedStatuses } }).select("+passwordResetLastSentAt");
  if (!user) return;
  const sentAt = user.passwordResetLastSentAt?.getTime();
  if (sentAt && Date.now() - sentAt < emailActionCooldownMs) return;
  await issuePasswordReset(user);
}

export async function validatePasswordResetToken(token) {
  const user = await User.exists({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
    status: { $in: signInAllowedStatuses },
  });
  if (!user) throw httpError(400, "RESET_LINK_INVALID", "This password reset link is invalid or expired. Request a new one and try again.");
  return { valid: true };
}

export async function resetPassword({ token, newPassword }) {
  if (Buffer.byteLength(newPassword, "utf8") > 72) {
    throw httpError(400, "VALIDATION_ERROR", "Password must not exceed 72 UTF-8 bytes");
  }
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  const user = await User.findOneAndUpdate({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
    status: { $in: signInAllowedStatuses },
  }, {
    $set: { passwordHash },
    $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1, passwordResetLastSentAt: 1 },
  }, { new: true, runValidators: true });
  if (!user) throw httpError(400, "RESET_LINK_INVALID", "This password reset link is invalid or expired. Request a new one and try again.");
  await RefreshSession.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  return publicUser(user);
}

export async function changePassword({ currentPassword, newPassword }, req) {
  if (Buffer.byteLength(newPassword, "utf8") > 72) {
    throw httpError(400, "VALIDATION_ERROR", "Password must not exceed 72 UTF-8 bytes");
  }
  const user = await User.findById(req.user.id).select("+passwordHash");
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw httpError(400, "CURRENT_PASSWORD_INVALID", "Current password is incorrect");
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw httpError(409, "PASSWORD_UNCHANGED", "Choose a password different from your current password");
  }
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await RefreshSession.updateMany(
    { userId: user._id, _id: { $ne: req.sessionId }, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  user.passwordHash = passwordHash;
  await user.save();
  return publicUser(user);
}

export async function deleteOwnAccount({ currentPassword }, req) {
  const user = await User.findById(req.user.id).select("+passwordHash");
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw httpError(400, "CURRENT_PASSWORD_INVALID", "Current password is incorrect");
  }
  if (user.role === "ADMIN") {
    const enabledAdmins = await User.countDocuments({ role: "ADMIN", status: { $in: signInAllowedStatuses } });
    if (enabledAdmins <= 1) throw httpError(409, "LAST_ADMIN", "The last enabled administrator account cannot be deleted");
  }

  await Screening.deleteMany({ userId: user._id });
  await RefreshSession.deleteMany({ userId: user._id });
  const deleted = await User.deleteOne({ _id: user._id, passwordHash: user.passwordHash });
  if (deleted.deletedCount !== 1) throw httpError(409, "ACCOUNT_CHANGED", "Account details changed during deletion. Sign in and try again.");
  return true;
}

export async function login({ email, password }, req, res) {
  const identifier = email.trim().toLowerCase();
  const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] }).select("+passwordHash");
  const validPassword = user ? await bcrypt.compare(password, user.passwordHash) : await bcrypt.compare(password, "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5QhSa/6dXkpM6BkPZqS5tU8FUY3ec6K");
  if (!user || !validPassword) {
    throw httpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  if (user.status === "NOT_VERIFIED") throw httpError(403, "EMAIL_NOT_VERIFIED", "Verify your email address before signing in.");
  if (!signInAllowedStatuses.includes(user.status)) throw httpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  user.lastLoginAt = new Date();
  await user.save();
  await issueSession(user, req, res);
  return publicUser(user);
}

function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, jwtOptions);
    if (payload.type !== "refresh" || typeof payload.sid !== "string" || typeof payload.sub !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, jwtOptions);
    if (payload.type !== "access" || typeof payload.sid !== "string" || typeof payload.sub !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function refresh(req, res) {
  const token = req.cookies?.[refreshCookie];
  const payload = token && verifyRefreshToken(token);
  if (!payload) throw httpError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");

  const session = await RefreshSession.findOne({ _id: payload.sid, userId: payload.sub }).select("+tokenHash");
  if (!session || !safeEqual(session.tokenHash, hashToken(token))) {
    clearAuthCookies(res);
    throw httpError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  }
  if (session.revokedAt) {
    await RefreshSession.updateMany({ userId: payload.sub, revokedAt: null }, { $set: { revokedAt: new Date() } });
    clearAuthCookies(res);
    throw httpError(401, "SESSION_REUSED", "A previous session token was reused. Please sign in again.");
  }
  if (session.expiresAt <= new Date()) {
    clearAuthCookies(res);
    throw httpError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  }
  const revoked = await RefreshSession.updateOne({ _id: session.id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  if (revoked.modifiedCount !== 1) {
    await RefreshSession.updateMany({ userId: payload.sub, revokedAt: null }, { $set: { revokedAt: new Date() } });
    clearAuthCookies(res);
    throw httpError(401, "SESSION_REUSED", "This session has already been refreshed. Please sign in again.");
  }
  const user = await User.findOne({ _id: payload.sub, status: { $in: signInAllowedStatuses } });
  if (!user) {
    clearAuthCookies(res);
    throw httpError(401, "SESSION_EXPIRED", "Your session is no longer active. Please sign in again.");
  }
  await issueSession(user, req, res);
  return publicUser(user);
}

export async function logout(req, res) {
  const token = req.cookies?.[refreshCookie];
  const payload = (token && verifyRefreshToken(token)) || (req.cookies?.[accessCookie] && verifyAccessToken(req.cookies[accessCookie]));
  const databaseConnected = mongoose.connection.readyState === 1;
  if (payload && databaseConnected) {
    await RefreshSession.updateOne({ _id: payload.sid, userId: payload.sub, revokedAt: null }, { $set: { revokedAt: new Date() } });
  }
  clearAuthCookies(res);
  return { revoked: !payload || databaseConnected };
}

export async function authenticate(req, _res, next) {
  const bearer = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = req.cookies?.[accessCookie] || bearer;
  if (!token) return next(httpError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue"));
  try {
    const payload = verifyAccessToken(token);
    if (!payload) throw new Error("Invalid access token");
    const [user, session] = await Promise.all([
      User.findOne({ _id: payload.sub, status: { $in: signInAllowedStatuses } }),
      RefreshSession.findOne({ _id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { $gt: new Date() } }),
    ]);
    if (!user || !session) throw httpError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue");
    req.user = user;
    req.sessionId = payload.sid;
    return next();
  } catch (error) {
    if (error.statusCode) return next(error);
    return next(httpError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue"));
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(httpError(403, "FORBIDDEN", "You do not have permission to perform this action"));
    return next();
  };
}

export function getCurrentUser(req) {
  return publicUser(req.user);
}

export const authCookies = { access: accessCookie, refresh: refreshCookie };
