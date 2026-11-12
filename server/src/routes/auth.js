import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RefreshSession } from "../models/refresh-session.js";
import { authenticate, clearAuthCookies, getCurrentUser, login, logout, refresh, register } from "../services/auth-service.js";
import { requireDatabase } from "../middleware/require-database.js";
import { loginSchema, parseBody, registerSchema } from "../validators/auth.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler(_req, res) {
    res.status(429).json({ success: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait and try again." }, requestId: res.getHeader("X-Request-ID") });
  },
});

authRouter.post("/register", requireDatabase, authLimiter, parseBody(registerSchema), async (req, res) => {
  const user = await register(req.validatedBody, req, res);
  res.status(201).json({ success: true, data: { user }, requestId: req.id });
});

authRouter.post("/login", requireDatabase, authLimiter, parseBody(loginSchema), async (req, res) => {
  const user = await login(req.validatedBody, req, res);
  res.json({ success: true, data: { user }, requestId: req.id });
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

authRouter.post("/logout-all", requireDatabase, authenticate, async (req, res) => {
  await RefreshSession.updateMany({ userId: req.user.id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  clearAuthCookies(res);
  res.json({ success: true, data: { loggedOut: true }, requestId: req.id });
});
