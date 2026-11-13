import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

if (process.env.VERCEL) {
  process.env.NEXT_PUBLIC_API_BASE_URL = "/api/v1";
  process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE = "false";
} else {
  const localEnv = {};
  const { error } = dotenv.config({
    path: fileURLToPath(new URL("../../.env", import.meta.url)),
    processEnv: localEnv,
  });
  if (error && error.code !== "ENOENT") throw error;
  for (const key of ["NEXT_PUBLIC_API_BASE_URL", "NEXT_PUBLIC_ENABLE_DEMO_MODE"]) {
    if (localEnv[key] !== undefined) process.env[key] ??= localEnv[key];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  outputFileTracingExcludes: { "/api/**": ["../../.env", "../../.env.*"] },
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: "/api/_express/v1/:path*" },
      { source: "/api/health/ready", destination: "/api/_express/health/ready" },
      { source: "/api/health", destination: "/api/_express/health" },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
