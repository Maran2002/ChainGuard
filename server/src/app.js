import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { httpError } from "./utils/http-error.js";
import { screeningRouter } from "./routes/screenings.js";
import { intelligenceRouter } from "./routes/intelligence.js";
import { adminIngestionRouter } from "./routes/admin-ingestion.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { adminProvidersRouter } from "./routes/admin-providers.js";
import { adminUsersRouter } from "./routes/admin-users.js";
import { adminIntelligenceRouter } from "./routes/admin-intelligence.js";
import { productionRateLimitStore } from "./middleware/mongo-rate-limit-store.js";

export const app = express();
export default app;

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY_HOPS);
app.use(helmet());
const allowedOrigins = env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim());

function isSameOriginRequest(req, origin) {
  try {
    const requestOrigin = new URL(origin).origin;
    const host = req.get("host");
    return Boolean(host && req.protocol && requestOrigin === `${req.protocol}://${host}`);
  } catch {
    return false;
  }
}
app.use(pinoHttp({
  logger,
  genReqId: () => randomUUID(),
  serializers: {
    req(req) {
      return { id: req.id, method: req.method };
    },
  },
}));
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use((req, res, next) => {
  req.id = req.id || randomUUID();
  res.setHeader("X-Request-ID", req.id);
  next();
});
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use((req, _res, next) => {
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (!isMutation) return next();

  let requestOrigin = req.headers.origin;
  if (!requestOrigin && req.headers.referer) {
    try {
      requestOrigin = new URL(req.headers.referer).origin;
    } catch {
      return next(httpError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed"));
    }
  }
  if (requestOrigin && !allowedOrigins.includes(requestOrigin) && !isSameOriginRequest(req, requestOrigin)) {
    return next(httpError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed"));
  }

  const hasAuthCookie = /(?:^|;\s*)(?:cg_access|cg_refresh)=/.test(req.headers.cookie || "");
  if (hasAuthCookie && !requestOrigin) {
    return next(httpError(403, "ORIGIN_REQUIRED", "A same-site origin is required for session changes"));
  }
  return next();
});
app.use(express.json({ limit: "100kb" }));
app.use((req, _res, next) => {
  const hasUnsafeKey = (value) => {
    if (!value || typeof value !== "object") return false;
    return Object.entries(value).some(([key, child]) =>
      key.startsWith("$") || key.includes(".") || key.includes("\0") || hasUnsafeKey(child)
    );
  };
  if (hasUnsafeKey(req.body) || hasUnsafeKey(req.query)) {
    return next(httpError(400, "UNSAFE_QUERY_KEY", "Request fields contain unsupported operator keys"));
  }
  return next();
});
app.use(cookieParser());
app.use(rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.NODE_ENV === "development" ? env.RATE_LIMIT_DEVELOPMENT_MAX_REQUESTS : env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: productionRateLimitStore("global"),
  skip: (req) => ["/health", "/health/ready"].includes(req.path) || mongoose.connection.readyState !== 1,
  handler(req, res) {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfterSeconds = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : null;
    res.status(429).json({
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests. Wait briefly before trying again.", ...(retryAfterSeconds ? { retryAfterSeconds } : {}) },
      requestId: req.id,
    });
  },
}));

app.get("/health", (req, res) => {
  res.json({ success: true, data: { status: "ok", service: env.APP_NAME }, requestId: req.id });
});

app.get("/health/ready", async (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  const statusCode = databaseReady ? 200 : 503;
  res.status(statusCode).json(databaseReady ? {
    success: true,
    data: { status: "ready", database: "connected" },
    requestId: req.id,
  } : {
    success: false,
    error: { code: "NOT_READY", message: "Database is not connected" },
    data: { status: "not_ready", database: "disconnected" },
    requestId: req.id,
  });
});

app.use(`${env.API_PREFIX}/auth`, authRouter);
app.use(`${env.API_PREFIX}/screenings`, screeningRouter);
app.use(`${env.API_PREFIX}/intelligence`, intelligenceRouter);
app.use(`${env.API_PREFIX}/admin/ingestion`, adminIngestionRouter);
app.use(`${env.API_PREFIX}/admin/users`, adminUsersRouter);
app.use(`${env.API_PREFIX}/admin/intelligence`, adminIntelligenceRouter);
app.use(`${env.API_PREFIX}/dashboard`, dashboardRouter);
app.use(`${env.API_PREFIX}/admin/providers`, adminProvidersRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "The requested API route was not found" },
    requestId: req.id,
  });
});

app.use((error, req, res, _next) => {
  req.log?.error({ err: error }, "Request failed");
  const statusCode = error.statusCode || (error.type === "entity.parse.failed" ? 400 : error.type === "entity.too.large" ? 413 : 500);
  const errorCode = error.code || (error.type === "entity.parse.failed" ? "INVALID_JSON" : error.type === "entity.too.large" ? "REQUEST_TOO_LARGE" : "INTERNAL_ERROR");
  const message = error.statusCode ? error.message : error.type === "entity.parse.failed" ? "Request body must be valid JSON" : error.type === "entity.too.large" ? "Request body is too large" : "An unexpected error occurred";
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(error.code === "VALIDATION_ERROR" ? { details: error.details || [] } : {}),
    },
    requestId: req.id,
  });
});
