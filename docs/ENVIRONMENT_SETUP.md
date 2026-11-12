# ChainGuard environment setup

This guide covers the current foundation scaffold and planned integrations. Client/server package manifests, placeholder-only environment examples, and root development scripts now exist. Do not put real credentials in the example files.

## Prerequisites

- Node.js LTS and npm with workspace support.
- MongoDB locally through Docker Compose or a MongoDB Atlas database/user with least-privilege access.
- Docker Desktop only if using the local MongoDB compose service.
- Optional provider accounts/credentials for live TRON, Ethereum, BSC, explorer, issuer, hosting, or Sentry integrations.

Use Node.js 20.9 or newer (Node 22.17 was used for this foundation) and npm. Root scripts include `dev`, `dev:client`, `dev:server`, `build`, `lint`, `test`, and `seed`; test and seed scripts have no implementations yet.

## Local setup

1. Install Node.js 20.9 or newer, npm, and optionally Docker Desktop.
2. Run `npm install` from the repository root.
3. Start local MongoDB with `docker compose up -d mongo`, or create a least-privilege Atlas database user and copy its URI into the server's local `.env`.
4. Copy `server/.env.example` to `server/.env`, and `client/.env.example` to `client/.env.local`. Replace placeholders with local values only. Never commit `.env` files.
5. Generate two independent, cryptographically random access and refresh secrets; do not reuse the example strings. Run `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` twice and place the results in the matching variables. The server rejects identical values and requires secure cookies in production.
6. Leave provider credentials blank; live screening adapters are not implemented yet. The dashboard uses clearly labeled simulated display data, while the screening form returns UNKNOWN because no sources are queried.
7. Run `npm run dev` from the root to start client and API. The API starts in degraded mode if MongoDB is not reachable; account actions require a connected MongoDB database.
8. Check `/health` for process status and `/health/ready` for database readiness.

Run `npm run dev` to start Next.js and Express together, or use `npm run dev:client` / `npm run dev:server` separately. `npm run build`, `npm run lint`, and `npm test` are available. Seeding is not implemented yet.

## Server variables

`server/.env.example` includes the variables below with safe placeholders. Never put actual credentials in the template.

| Variable | Purpose | Requirement / handling |
|---|---|---|
| `NODE_ENV` | Runtime mode | `development` locally; production settings in deployed environment. |
| `PORT` | Express listen port | Local default `5000`. |
| `API_PREFIX` | API route prefix | `/api/v1`. |
| `APP_NAME` | Service/logging name | `ChainGuard`. |
| `CLIENT_ORIGIN` | Allowed browser origins, comma-separated | Local Next.js origin (`http://localhost:3000`); exact production origins only. |
| `MONGODB_URI` | MongoDB connection | Required; local default URI or secured Atlas secret. Never log it. |
| `JWT_ACCESS_SECRET` | Access-token signing key | Required strong random secret, at least 32 bytes; separate from refresh secret. Never use the example value in production. |
| `JWT_ACCESS_EXPIRES_IN` | Access lifetime | Example `15m`. |
| `JWT_REFRESH_SECRET` | Refresh-token signing key | Required, distinct strong random secret. Refresh tokens are stored as hashes and rotated on use. |
| `JWT_REFRESH_EXPIRES_IN` | Refresh lifetime | Example `7d`; rotation and revocation required. |
| `COOKIE_SECURE` | Secure cookie flag | `false` for local HTTP only; must be `true` in HTTPS production. |
| `COOKIE_SAME_SITE` | SameSite cookie behavior | Local/production policy, usually `lax`; coordinate with deployment origins. |
| `BCRYPT_ROUNDS` | Password-hash work factor | Example `12`; assess host performance. |
| `BLOCKCHAIN_PROVIDER_MODE` | Select default provider adapter | `unavailable` by default; `mock` returns explicitly labeled fixture-only data. No live chain adapter is implemented yet. |
| `RATE_LIMIT_WINDOW_MS` | API rate window | Example `900000`. |
| `RATE_LIMIT_MAX_REQUESTS` | Requests per window | Example `100`, tuned by route and provider budget. |
| `TRON_RPC_URL`, `TRON_API_KEY` | TRON provider configuration | Optional; keep credential-bearing endpoints server-side and redact logs. |
| `ETHEREUM_RPC_URL`, `ETHEREUM_API_KEY` | Ethereum provider configuration | Optional; chain remains unavailable until verified/configured. |
| `BSC_RPC_URL`, `BSC_API_KEY` | BNB Smart Chain provider configuration | Optional; chain remains unavailable until verified/configured. |
| `TRONSCAN_API_KEY`, `ETHERSCAN_API_KEY`, `BSCSCAN_API_KEY` | Optional explorer data | Optional; observe quotas, terms and rate limits. |
| `INTELLIGENCE_INGESTION_ENABLED` | Gate ingestion operations | Default `false`; enable only with approved sources/configuration. |
| `INTELLIGENCE_USER_AGENT` | Source identification/contact | Use an actual operational contact before public ingestion. |
| `INTELLIGENCE_SOURCE_TIMEOUT_MS` | Source request timeout | Example `15000`; enforce bounded requests. |
| `TETHER_FREEZE_SOURCE_URL` | Configured issuer source | Optional fixed source; never accept arbitrary user-provided URL. |
| `STABLECOIN_PROVIDER_API_KEY` | Optional issuer/provider credential | Server-only. |
| `LOG_LEVEL` | Structured log verbosity | Example `info`; ensure redaction at every level. |
| `SENTRY_DSN` | Optional server error monitoring | Optional secret; never expose in a public client variable unless specifically designed as public DSN. |

## Client variables

Only public values belong in `client/.env.example`:

| Variable | Purpose | Example |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Public API base URL | `http://localhost:5000/api/v1` |
| `NEXT_PUBLIC_APP_NAME` | Browser-visible product name | `ChainGuard` |
| `NEXT_PUBLIC_ENABLE_DEMO_MODE` | Enable clearly labeled fixture/demo experience | `true` locally; normally `false` in production. |

Anything prefixed with `NEXT_PUBLIC_` is exposed in browser code. Never set API keys, RPC credentials, MongoDB URIs, JWT secrets, or other private values there. Keep server-only variables in the Express server environment; do not rely on Next.js server runtime as a place to duplicate API secrets unnecessarily.

## Provider configuration and current blockers

No credentials are present in the inspected repository. Basic local work should not require paid services: use local MongoDB and fixture-backed mock providers. To enable live service, configure server-side credentials and verify provider terms, quotas, attribution, and connectivity. Confirm official USDT contract addresses for each chain before live enablement. Public sanctions/issuer sources still require verified access methods and parser fixtures; do not infer or fabricate an API.

## Production handling

- Set secrets in the host's secret manager, not in committed files or build arguments.
- Use MongoDB TLS and a least-privilege database user.
- Serve over HTTPS, set secure cookies, and allow only exact frontend origins.
- Disable demo seeding and `NEXT_PUBLIC_ENABLE_DEMO_MODE` unless the deployment is explicitly a demo.
- Configure provider timeouts/quotas and distinguish `LIVE`, `MOCK`, and `UNAVAILABLE` in responses and UI.
- Validate configuration at startup and fail clearly with redacted messages when required values are missing.
- Rotate secrets through the hosting secret manager and revoke refresh sessions as needed.
