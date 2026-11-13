import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  API_PREFIX: z.string().startsWith("/").default("/api/v1"),
  APP_NAME: z.string().min(1).default("ChainGuard"),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/chainguard"),
  BREVO_SENDER_NAME: z.string().trim().max(100).default(""),
  BREVO_SENDER_EMAIL: z.string().trim().email().or(z.literal("")).default(""),
  BREVO_API_KEY: z.string().trim().default(""),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().regex(/^[1-9]\d*(s|m|h|d)$/).default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().regex(/^[1-9]\d*(s|m|h|d)$/).default("7d"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("lax"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  BLOCKCHAIN_PROVIDER_MODE: z.enum(["unavailable", "mock", "live"]).default("unavailable"),
  TRON_RPC_URL: z.string().trim().default(""),
  TRON_API_KEY: z.string().trim().default(""),
  TRONSCAN_API_KEY: z.string().trim().default(""),
  ETHEREUM_RPC_URL: z.string().trim().default(""),
  ETHEREUM_API_KEY: z.string().trim().default(""),
  BSC_RPC_URL: z.string().trim().default(""),
  BSC_API_KEY: z.string().trim().default(""),
  NODEREAL_API_KEY: z.string().trim().default(""),
  INTELLIGENCE_INGESTION_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  INTELLIGENCE_SOURCE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_DEVELOPMENT_MAX_REQUESTS: z.coerce.number().int().positive().max(10000).default(1000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map(({ path, message }) => `${path.join(".")}: ${message}`).join("; ");
  throw new Error(`Invalid server configuration: ${issues}`);
}

export const env = parsed.data;

if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values");
}

if (env.NODE_ENV === "production" && !env.COOKIE_SECURE) {
  throw new Error("Production cookies require COOKIE_SECURE=true");
}

if (env.NODE_ENV === "production") {
  const origins = env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim());
  if (!origins.length || origins.some((origin) => {
    try {
      const parsedOrigin = new URL(origin);
      return parsedOrigin.protocol !== "https:" || parsedOrigin.origin !== origin;
    } catch {
      return true;
    }
  })) {
    throw new Error("Production CLIENT_ORIGIN must contain exact HTTPS origins without paths");
  }
  if (![env.BREVO_SENDER_NAME, env.BREVO_SENDER_EMAIL, env.BREVO_API_KEY].every(Boolean)) {
    throw new Error("Production email verification requires all Brevo sender and API settings");
  }
}

if (env.COOKIE_SAME_SITE === "none" && !env.COOKIE_SECURE) {
  throw new Error("COOKIE_SAME_SITE=none requires COOKIE_SECURE=true");
}

const brevoConfigValues = [env.BREVO_SENDER_NAME, env.BREVO_SENDER_EMAIL, env.BREVO_API_KEY];
if (brevoConfigValues.some(Boolean) && !brevoConfigValues.every(Boolean)) {
  throw new Error("BREVO_SENDER_NAME, BREVO_SENDER_EMAIL, and BREVO_API_KEY must be configured together");
}

if (env.NODE_ENV === "production" && [env.JWT_ACCESS_SECRET, env.JWT_REFRESH_SECRET].some((secret) => secret.startsWith("replace_with_"))) {
  throw new Error("Production JWT secrets must be replaced with generated values");
}
