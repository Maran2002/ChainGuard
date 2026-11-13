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
| `src/app/` | Next.js App Router pages and layouts |
| `src/pages/api/` | Node Function that forwards same-origin requests to Express |
| `src/server/` | Express routes, services, adapters, MongoDB models, and scripts |
| `package.json` and `package-lock.json` | Root scripts, dependencies, and lockfile |
| `vercel.json` | Vercel build settings for the repository root |
| `.env.example` | Sanitized template for the single root `.env` |

## Local development

### Requirements

- Node.js 22.x, matching the Vercel runtime.
- npm.
- MongoDB, local or hosted.

### Start the app

From the repository root, install dependencies and create the local environment file if it is missing.

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Next.js loads the root `.env`. Server scripts resolve the same file relative to their configuration module. Existing shell variables take precedence. Use `NEXT_PUBLIC_API_BASE_URL=/api/v1` for the integrated app. If upgrading an older checkout, replace the previous `http://localhost:5000/api/v1` setting.

Set distinct, randomly generated `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values in root `.env`. Each must be at least 32 characters. Run this command twice to generate the values.

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Run that command twice, using one output for each secret. Make sure MongoDB is running and `MONGODB_URI` points to it. The example URI uses local MongoDB on port 27017.

```powershell
npm run dev
```

One Next.js process serves the UI and API at `http://localhost:3000`. The API uses `/api/v1`, with liveness at `/api/health` and database readiness at `/api/health/ready`. The template enables local demo mode. Set `NEXT_PUBLIC_ENABLE_DEMO_MODE=false` to exercise the authenticated flow.

### Useful commands

```powershell
npm run lint
npm run build
npm start
npm test
npm run providers:verify
npm run security:preflight
```

Feed ingestion commands are administrator-facing operational tools; use the Admin UI to preview a source before applying it. Provider verification checks only the configured runtime and credentials; it does not guarantee complete chain coverage.

## Vercel deployment

ChainGuard can run as **one Vercel project**: Next.js serves the UI, and a Vercel Node Function invokes the existing Express app for `/api/v1/*`. The function opens MongoDB on demand and returns a service-unavailable response if the database cannot be reached.

1. In the existing project's **Build and Deployment** settings, clear **Root Directory** to select the repository root (`/`). Select **Next.js** and **Node.js 22.x**. [Vercel build settings](https://vercel.com/docs/builds/configure-a-build)
2. The root [vercel.json](vercel.json) sets **Install Command** to `npm ci --include=dev`, **Build Command** to `npm run build`, and **Output Directory** to `.next`. Including development dependencies ensures Next.js can resolve the Tailwind PostCSS plugin during production builds. Clear any old dashboard overrides for those settings. The root `.vercelignore` excludes local environment files from CLI uploads.
3. Configure the required values in this project's **Environment Variables**, scoped to **Production** and **Preview**, plus any optional providers. Scope **Development** values to development tooling. Set `MONGODB_URI` to a reachable managed database, `CLIENT_ORIGIN` to the exact HTTPS origin for email links, distinct JWT secrets, all three Brevo settings, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax`, and `TRUST_PROXY_HOPS=1`. Keep Vercel system variables enabled so the build and runtime can detect `VERCEL`. [Vercel environment variables](https://vercel.com/docs/environment-variables)
4. Deploy after saving the settings. Vercel builds use same-origin `/api/v1` and disable demo mode. The Next.js rewrites route `/api/v1/*`, `/api/health`, and `/api/health/ready` to the Node Function. Check both health URLs on the deployment origin, then sign in and check `/api/v1/auth/me`.

Use a stable Preview origin for verification and password reset links. The API Function reads injected environment variables and reuses its MongoDB connection on warm invocations. During a database outage, liveness stays available and database-backed requests return 503.

## Environment variables

The API validates settings in [src/server/config/env.js](src/server/config/env.js). **[REQUIRED]** marks required values, **[OPTIONAL]** marks settings with defaults, **[LOCAL]** marks local inputs, **[VERCEL]** marks deployment inputs, and **[CONDITIONAL]** marks feature-specific requirements.

Never commit `.env` or credentials. The root `.env.example` contains safe defaults and placeholders.

### Public web settings

| Variable | Tag | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | [OPTIONAL] [LOCAL] | Browser-visible API base URL. The default for local development and Vercel is `/api/v1`. |
| `NEXT_PUBLIC_ENABLE_DEMO_MODE` | [OPTIONAL] [LOCAL] | Enables local demo behavior when `true`. Vercel builds disable demo mode. |

Only values intentionally prefixed with `NEXT_PUBLIC_` belong in client configuration; they are exposed to browsers and must not contain secrets.

### API settings

| Variable | Tag | Purpose |
| --- | --- | --- |
| `NODE_ENV` | [LOCAL] [VERCEL] | Runtime mode (`development`, `test`, or `production`). Vercel supplies `production` for deployed Functions, enabling production security checks and rate limits. |
| `API_PREFIX` | [OPTIONAL] | API route prefix, default `/api/v1`. Keep `/api/v1` on Vercel to match the rewrite. |
| `APP_NAME` | [OPTIONAL] | Service name used in application messages/logging; defaults to `ChainGuard`. |
| `CLIENT_ORIGIN` | [REQUIRED] [VERCEL] | Exact HTTPS origin used for auth email links and allowed cross-origin requests, e.g. `https://chainguard.example.com`. For this single-project deployment, the UI and API share this origin. Production values must have no path. |
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
| `ETHEREUM_API_KEY` | [OPTIONAL] | Presence metadata for the admin provider page. Ethereum queries authenticate through the RPC URL, which can embed a credential. |
| `BSC_RPC_URL` | [CONDITIONAL] | BSC JSON-RPC endpoint for basic live chain queries. |
| `BSC_API_KEY` | [OPTIONAL] | Presence metadata for the admin provider page. BSC RPC uses the configured endpoint and indexed history uses NodeReal. |
| `NODEREAL_API_KEY` | [CONDITIONAL] [VERCEL] | Dedicated NodeReal key used for BSC indexed native and ERC-20 transfer history. Configure it for production; shared fallback capacity is only for limited development checks. |
| `INTELLIGENCE_INGESTION_ENABLED` | [OPTIONAL] | Set `true` to enable admin-triggered intelligence ingestion endpoints; default `false`. It does not schedule ingestion automatically. |
| `INTELLIGENCE_SOURCE_TIMEOUT_MS` | [OPTIONAL] | Per-source ingestion request timeout in milliseconds (1000–60000); default `15000`. Keep it within the serverless execution budget. |
| `RATE_LIMIT_WINDOW_MS` | [OPTIONAL] | Rate-limit window in milliseconds; default `900000` (15 minutes). |
| `RATE_LIMIT_MAX_REQUESTS` | [OPTIONAL] | Maximum requests per IP per rate-limit window outside development; default `100`. |
| `RATE_LIMIT_DEVELOPMENT_MAX_REQUESTS` | [OPTIONAL] [LOCAL] | Development request limit; default `1000`. It is not used as the production limit. |
| `TRUST_PROXY_HOPS` | [OPTIONAL] [VERCEL] | Number of trusted reverse-proxy hops for Express IP handling. Defaults to `1` on Vercel and `0` locally. |
| `LOG_LEVEL` | [OPTIONAL] | Logging verbosity (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`); default `info`. |

### Operational inputs

| Variable | Tag | Purpose |
| --- | --- | --- |
| `VERCEL` | [VERCEL] | Vercel system flag. Activates injected API configuration, same-origin web settings, and the one-hop proxy default. |
| `CHAINGUARD_ADMIN_PASSWORD` | [LOCAL] [CONDITIONAL] | Required for `npm run seed:admin`. Supply it to the seed process. |
| `npm_config_source`, `npm_config_apply` | [LOCAL] [OPTIONAL] | Legacy npm inputs for ingestion. Use the CLI flags `--source` and `--apply`. |

The legacy `ETHERSCAN_API_KEY` is unused. Ethereum queries use `ETHEREUM_RPC_URL`, including Alchemy indexed-history calls. The Vercel CLI can generate a temporary `VERCEL_OIDC_TOKEN` during an environment pull. ChainGuard does not read that token. If an older `.env` still sets `PORT=5000`, remove that legacy Express setting. To change the local Next.js port, pass `npm run dev -- --port <port>`.

## Security and operational notes

- Use HTTPS, unique production secrets, exact CORS origins, and a least-privilege MongoDB user.
- Configure Brevo sender authentication before production; registration and password-reset mail depend on it.
- Keep provider and intelligence-feed credentials server-side. Client `NEXT_PUBLIC_*` values are public.
- Review source coverage and upstream generation time as well as the last successful apply time. Applying a snapshot does not make an old source snapshot fresh.
- A source being connected or returning zero matches is not proof of full coverage.
- Vercel Functions have finite execution limits that depend on configuration and plan; keep API operations bounded and check the current [function limits](https://vercel.com/docs/functions/limitations).

## License

No license has been declared in this repository yet. Contact the project owner before redistributing it.
