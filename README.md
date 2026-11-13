# ChainGuard

ChainGuard is a read-only wallet risk screening and investigation app for TRON, Ethereum, and BNB Smart Chain (BSC). It combines configured intelligence feeds, sanctions data, provider-backed address and transaction history, and wallet relationships into an explainable result with source coverage and freshness indicators.

The result is evidence available at screening time. A low-risk or `UNKNOWN` result is not proof that an address is safe. The app never requests private keys, signs transactions, or moves funds.

## What it does

- Screens supported wallet networks and keeps user-owned screening history.
- Shows evidence, source coverage, provider status, and feed freshness so incomplete data is visible.
- Investigates bounded wallet relationships and transfer history with a graph and table view.
- Supports verified-email registration and password reset through Brevo, session management, and role-based admin tools.
- Provides administrator workflows to preview and apply configured intelligence feeds.

### Data coverage notes

- Live coverage depends on configured providers and source availability. Missing credentials or unsupported categories can produce an incomplete or `UNKNOWN` result.
- BSC indexed native and ERC-20 history uses NodeReal. Configure a dedicated `NODEREAL_API_KEY` for production usage; a shared fallback is intended only for limited development checks.
- TRON account-security flags can be queried live through TRONSCAN when `TRONSCAN_API_KEY` is configured. This is not a bulk phishing, drainer, or theft feed.
- EVM-wide intelligence labels do not prove that a contract is deployed on BSC.
- Intelligence ingestion is disabled by default and can be enabled for administrator-managed runs. A successful apply time and the upstream snapshot generation time are distinct freshness facts.

## Repository layout

| Path | Purpose |
| --- | --- |
| `client/` | Next.js web application |
| `server/` | Express API, adapters, services, and scripts |
| `server/src/adapters/` | Blockchain and intelligence-source integrations |
| `server/src/routes/` | API routes, including user and admin endpoints |
| `server/src/models/` | MongoDB models |
| `client/.env.example` | Public client configuration template |
| `server/.env.example` | API configuration template |

## Local development

### Requirements

- Node.js 20.9 or newer (Node.js 22 is supported by the current project runtime).
- npm.
- MongoDB, local or hosted.

### Start the app

From the repository root, install dependencies and create local environment files:

```powershell
npm install
Copy-Item client/.env.example client/.env.local
Copy-Item server/.env.example server/.env
```

Set distinct, randomly generated `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values in `server/.env`. Each must be at least 32 characters. For example, generate values with Node:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Run that command twice, using one output for each secret. Make sure MongoDB is running and `MONGODB_URI` points to it. The example URI uses local MongoDB on port 27017.

```powershell
npm run dev
```

The web app defaults to `http://localhost:3000` and the API to `http://localhost:5000`; the API base path is `/api/v1`. Local demo mode is enabled by the example client environment. Set it to `false` when you want to exercise the normal authenticated flow.

### Useful commands

```powershell
npm run lint
npm run build
npm test
npm --workspace @chainguard/server run providers:verify
npm --workspace @chainguard/server run security:preflight
```

Feed ingestion commands are administrator-facing operational tools; use the Admin UI to preview a source before applying it. Provider verification checks only the configured runtime and credentials; it does not guarantee complete chain coverage.

## Vercel deployment

Deploy the web app and API as **two Vercel projects from this repository**. In each project, set its Root Directory to the relevant workspace. Vercel documents this monorepo setup using separate projects per workspace ([monorepos](https://vercel.com/docs/monorepos)).

### 1. Deploy the API project

- Set Root Directory to `server/`.
- Use the Node.js runtime and the workspace's `npm run start` command (`src/server.js`). Vercel supports Express applications as Functions; verify the detected build and API route after the first deployment ([Express on Vercel](https://vercel.com/docs/frameworks/backend/express)).
- Configure the server variables in the table below in the Vercel project's Environment Variables settings. Set secrets in the Production environment and any Preview/Development environments where you need the feature. Vercel scopes values by environment, and changed values apply to new deployments ([environment variables](https://vercel.com/docs/environment-variables)).
- Use a managed MongoDB deployment reachable from Vercel (for example, MongoDB Atlas); do not use the local example URI.
- Set `NODE_ENV=production`, `COOKIE_SECURE=true`, exact HTTPS `CLIENT_ORIGIN` values, and separate production JWT secrets. Provide all three Brevo values: production startup requires email verification configuration.
- Set `TRUST_PROXY_HOPS=1` for the Vercel-hosted API so Express rate limiting uses Vercel's client IP forwarding correctly. Vercel documents its forwarded client IP headers [here](https://vercel.com/docs/headers/request-headers).
- Use a dedicated NodeReal key for BSC indexed history. Keep provider request depths and timeouts bounded for serverless execution.

### 2. Deploy the web project

- Set Root Directory to `client/` and use the Next.js framework preset.
- Set `NEXT_PUBLIC_API_BASE_URL` to the deployed API URL including `/api/v1`, for example `https://api.example.com/api/v1`.
- Set `NEXT_PUBLIC_ENABLE_DEMO_MODE=false` for production.
- Add the exact web origin (scheme and host, no path) to the API's `CLIENT_ORIGIN`. If using preview deployments, add the specific preview origin(s) to that environment's API configuration, or use a stable preview domain. Do not use a wildcard origin for credentialed authentication.

For cookie-based authentication, prefer app and API subdomains under the same site (for example `app.example.com` and `api.example.com`) with `COOKIE_SAME_SITE=lax` and `COOKIE_SECURE=true`. If they are genuinely cross-site, use `COOKIE_SAME_SITE=none` with `COOKIE_SECURE=true`, and retain exact credentialed CORS origins. After changing Vercel environment values, redeploy the relevant project. No Vercel project is configured by this README; deployment and production smoke checks remain operator actions.

## Environment variables

Tags: **[REQUIRED]** must be set for the stated deployment or feature; **[OPTIONAL]** enables or tunes a feature; **[LOCAL]** local default; **[VERCEL]** deployment-specific setting; **[CONDITIONAL]** required only when using the associated feature or topology.

Never commit `.env`, `.env.local`, credentials, or generated production secrets. The checked-in `.env.example` files contain placeholders only.

### Client (`client/.env.local`)

| Variable | Tag | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | [REQUIRED] [VERCEL] | Browser-visible API base URL, including `/api/v1`. Local default is `http://localhost:5000/api/v1`; use the deployed HTTPS API URL in Vercel. |
| `NEXT_PUBLIC_ENABLE_DEMO_MODE` | [OPTIONAL] [LOCAL] | Enables the local demo/auth gate behavior when `true`. Set to `false` in production so users go through the real API-backed account flow. |

Only values intentionally prefixed with `NEXT_PUBLIC_` belong in client configuration; they are exposed to browsers and must not contain secrets.

### API (`server/.env`)

| Variable | Tag | Purpose |
| --- | --- | --- |
| `NODE_ENV` | [LOCAL] [VERCEL] | Runtime mode (`development`, `test`, or `production`). Vercel production deployment must use `production`; this enables production security checks and rate limits. |
| `PORT` | [LOCAL] [VERCEL] | Local API listen port (default `5000`). Vercel/runtime may supply the port; do not hardcode a deployment port unless the platform requires it. |
| `API_PREFIX` | [OPTIONAL] | API route prefix, default `/api/v1`; keep it aligned with `NEXT_PUBLIC_API_BASE_URL`. |
| `APP_NAME` | [OPTIONAL] | Service name used in application messages/logging; defaults to `ChainGuard`. |
| `CLIENT_ORIGIN` | [REQUIRED] [VERCEL] | Comma-separated exact browser origins allowed by CORS and auth links, e.g. `https://app.example.com`. Production values must be HTTPS origins with no path. |
| `MONGODB_URI` | [REQUIRED] | MongoDB connection string for accounts, sessions, and screening records. Use a reachable managed database URI in Vercel, not the local default. |
| `BREVO_SENDER_NAME` | [REQUIRED] [CONDITIONAL] | Verified sender display name for registration verification and password-reset email. All three Brevo settings are required together; mandatory in production. |
| `BREVO_SENDER_EMAIL` | [REQUIRED] [CONDITIONAL] | Verified sender email address for transactional email. All three Brevo settings are required together; mandatory in production. |
| `BREVO_API_KEY` | [REQUIRED] [CONDITIONAL] | Secret Brevo API credential used by the server to send verification and reset messages. Never expose it to the client. |
| `JWT_ACCESS_SECRET` | [REQUIRED] | Secret used to sign short-lived access tokens. Must be at least 32 characters and distinct from the refresh secret; generate a random value for every environment. |
| `JWT_ACCESS_EXPIRES_IN` | [OPTIONAL] | Access-token lifetime such as `15m`; default `15m`. |
| `JWT_REFRESH_SECRET` | [REQUIRED] | Secret used to sign refresh tokens. Must be at least 32 characters, randomly generated, and different from `JWT_ACCESS_SECRET`. |
| `JWT_REFRESH_EXPIRES_IN` | [OPTIONAL] | Refresh-token lifetime such as `7d`; default `7d`. |
| `COOKIE_SECURE` | [REQUIRED] [VERCEL] | Use `true` over HTTPS in production; production startup rejects `false`. Local HTTP default is `false`. |
| `COOKIE_SAME_SITE` | [OPTIONAL] [CONDITIONAL] | Cookie cross-site policy: `lax` (default), `strict`, or `none`. `none` is needed only for genuinely cross-site app/API origins and requires `COOKIE_SECURE=true`. |
| `BCRYPT_ROUNDS` | [OPTIONAL] | Password hashing cost, integer 10–15; default `12`. Higher values increase hashing time and CPU use. |
| `BLOCKCHAIN_PROVIDER_MODE` | [OPTIONAL] | Selects `unavailable`, `mock`, or `live` provider behavior; default `unavailable`. Use `live` for configured production chain providers; mock mode is for development only. |
| `TRON_RPC_URL` | [CONDITIONAL] | TRON provider endpoint URL required for live TRON chain queries. Keep the endpoint secret if it embeds credentials. |
| `TRON_API_KEY` | [CONDITIONAL] | TronGrid API key for authenticated TRON requests. Needed when the selected endpoint/provider requires it. |
| `TRONSCAN_API_KEY` | [OPTIONAL] [CONDITIONAL] | Enables live TRONSCAN account-security risk flags. These flags are not a substitute for a bulk TRON phishing/drainer/theft feed. |
| `ETHEREUM_RPC_URL` | [CONDITIONAL] | Ethereum JSON-RPC endpoint used for live chain queries/history. Use a provider endpoint with suitable indexed-history support for the app's queries. |
| `ETHEREUM_API_KEY` | [OPTIONAL] | Credential metadata for Ethereum provider status; if the provider key is embedded in the RPC URL, treat that URL as a secret. |
| `BSC_RPC_URL` | [CONDITIONAL] | BSC JSON-RPC endpoint for basic live chain queries. |
| `BSC_API_KEY` | [OPTIONAL] | Credential metadata for BSC provider status; indexed BSC transfer history uses NodeReal configuration below. |
| `NODEREAL_API_KEY` | [CONDITIONAL] [VERCEL] | Dedicated NodeReal key used for BSC indexed native and ERC-20 transfer history. Configure it for production; shared fallback capacity is only for limited development checks. |
| `INTELLIGENCE_INGESTION_ENABLED` | [OPTIONAL] | Set `true` to enable admin-triggered intelligence ingestion endpoints; default `false`. It does not schedule ingestion automatically. |
| `INTELLIGENCE_SOURCE_TIMEOUT_MS` | [OPTIONAL] | Per-source ingestion request timeout in milliseconds (1000–60000); default `15000`. Keep it within the serverless execution budget. |
| `RATE_LIMIT_WINDOW_MS` | [OPTIONAL] | Rate-limit window in milliseconds; default `900000` (15 minutes). |
| `RATE_LIMIT_MAX_REQUESTS` | [OPTIONAL] | Maximum requests per IP per rate-limit window outside development; default `100`. |
| `RATE_LIMIT_DEVELOPMENT_MAX_REQUESTS` | [OPTIONAL] [LOCAL] | Development request limit; default `1000`. It is not used as the production limit. |
| `TRUST_PROXY_HOPS` | [OPTIONAL] [VERCEL] | Number of trusted reverse-proxy hops for Express IP handling. Use `1` for the Vercel API path; local direct server default is `0`. Set to match the actual proxy topology. |
| `LOG_LEVEL` | [OPTIONAL] | Logging verbosity (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`); default `info`. |

The example files list the supported settings and defaults. Remove any blank optional value you do not use, or leave it empty; do not deploy the example JWT placeholders.

## Security and operational notes

- Use HTTPS, unique production secrets, exact CORS origins, and a least-privilege MongoDB user.
- Configure Brevo sender authentication before production; registration and password-reset mail depend on it.
- Keep provider and intelligence-feed credentials server-side. Client `NEXT_PUBLIC_*` values are public.
- Review source coverage and upstream generation time as well as the last successful apply time. Applying a snapshot does not make an old source snapshot fresh.
- A source being connected or returning zero matches is not proof of full coverage.
- Vercel Functions have finite execution limits that depend on configuration and plan; keep API operations bounded and check the current [function limits](https://vercel.com/docs/functions/limitations).

## License

No license has been declared in this repository yet. Contact the project owner before redistributing it.
