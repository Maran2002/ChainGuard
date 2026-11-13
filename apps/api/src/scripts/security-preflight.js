import { env } from "../config/env.js";

const failures = [];
const warnings = [];

if (env.NODE_ENV !== "production") failures.push("NODE_ENV must be production for this preflight");
if (!/^mongodb\+srv:\/\//i.test(env.MONGODB_URI) && !/[?&](?:tls|ssl)=true(?:&|$)/i.test(env.MONGODB_URI)) {
  failures.push("MONGODB_URI must use MongoDB SRV TLS or explicitly enable TLS");
}
if (env.TRUST_PROXY_HOPS === 0) warnings.push("TRUST_PROXY_HOPS is 0; confirm this is correct for the public API network path");
if (env.COOKIE_SAME_SITE === "none" && !env.COOKIE_SECURE) failures.push("SameSite=None cookies require COOKIE_SECURE=true");

for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const failure of failures) console.error(`FAIL ${failure}`);
if (failures.length) process.exitCode = 1;
else console.log("PASS production configuration checks; run security:probe against the deployed client and API URLs before release");
