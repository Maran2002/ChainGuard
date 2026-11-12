import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { RefreshSession } from "../models/refresh-session.js";
import { User } from "../models/user.js";
import { httpError } from "../utils/http-error.js";

const accessCookie = "cg_access";
const refreshCookie = "cg_refresh";
const jwtOptions = { issuer: env.APP_NAME, audience: "chainguard-client" };

function durationMs(value) {
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(value);
  if (!match) throw new Error("JWT expiration must be a positive number followed by s, m, h, or d");
  const scales = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return Number(match[1]) * scales[match[2]];
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
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
  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, createdAt: user.createdAt };
}

export async function register({ name, email, password }, req, res) {
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw httpError(400, "VALIDATION_ERROR", "Password must not exceed 72 UTF-8 bytes");
  }
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  let user;
  try {
    user = await User.create({ name, email: email.toLowerCase(), passwordHash, role: "USER" });
  } catch (error) {
    if (error?.code === 11000) throw httpError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
    throw error;
  }
  await issueSession(user, req, res);
  return publicUser(user);
}

export async function login({ email, password }, req, res) {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  const validPassword = user ? await bcrypt.compare(password, user.passwordHash) : await bcrypt.compare(password, "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5QhSa/6dXkpM6BkPZqS5tU8FUY3ec6K");
  if (!user || !validPassword || user.status !== "ACTIVE") {
    throw httpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
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
  const user = await User.findOne({ _id: payload.sub, status: "ACTIVE" });
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
      User.findOne({ _id: payload.sub, status: "ACTIVE" }),
      RefreshSession.findOne({ _id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { $gt: new Date() } }),
    ]);
    if (!user || !session) throw httpError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue");
    req.user = user;
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
