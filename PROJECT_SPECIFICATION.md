# ChainGuard — Codex Project Reconstruction Specification

> **Purpose:** This document is the implementation contract for rebuilding a complete, portfolio-grade blockchain wallet risk intelligence platform from scratch.
>
> **Primary instruction to Codex:** Read this entire document before changing files. Then inspect the existing repository (if any), create an implementation plan, and build the application end-to-end. Do not stop after scaffolding, mock UI, or a partial MVP. Implement the specified functionality, verify it with tests, and document any external integration that cannot be exercised without credentials.
>
> **Project name:** ChainGuard  
> **Product category:** Blockchain wallet screening / Know Your Transaction (KYT) risk intelligence  
> **Target:** A credible, secure, maintainable full-stack JavaScript project suitable for demonstrating Full-Stack Developer skills.

---

## 0. Non-negotiable engineering rules

1. **JavaScript only.** Use `.js`, `.jsx`, and `.mjs` where appropriate. Do not use TypeScript (`.ts`, `.tsx`) anywhere in application source, configuration, tests, or scripts. Do not introduce `tsconfig.json`.
2. Use modern JavaScript (ES modules), React, Node.js, Express, and MongoDB.
3. Use a monorepo with separate `client` and `server` applications.
4. Keep the code modular, readable, documented where logic is non-obvious, and production-minded.
5. Never commit credentials, API keys, private keys, access tokens, or real user data.
6. Provide `.env.example` files with every required/optional environment variable, descriptions, and safe placeholder values. **Never put actual secrets in `.env.example`.**
7. Validate all inputs at API boundaries. Use centralized error handling and consistent API response structures.
8. Use server-side authorization for every protected operation. Hiding UI controls is not security.
9. Do not trust client-provided risk scores, wallet ownership, roles, tenant IDs, or screening results.
10. Never imply a wallet is “safe” merely because no known threat record was found. Use explicit coverage, freshness, and uncertainty messaging.
11. Do not fabricate sanctions records, blockchain transactions, performance benchmarks, or test results. Seed/demo data must be visibly labeled.
12. If credentials are unavailable, implement an adapter, deterministic mock provider, clear setup instructions, and tests. Do not silently pretend a live provider was queried.
13. Do not add paid services or subscriptions without documenting the cost and providing a free/local alternative where practical.
14. Preserve all existing user work if this document is applied to an existing repository. Inspect first; do not delete or overwrite unrelated files.
15. After implementation, run linting, tests, and production builds. Fix errors rather than merely reporting them.

---

# 1. Product definition

ChainGuard enables users to investigate a blockchain wallet and understand its potential risk before interacting with it.

The application should support:

- Wallet address validation by chain.
- Screening against known sanctions, stablecoin issuer freezes, scams, hacks, and suspicious entities.
- Risk assessment based on transparent, explainable rules.
- Counterparty exposure investigation from transaction history.
- Wallet relationship visualization.
- Searchable intelligence directory.
- User accounts and screening history.
- Data-source freshness and coverage transparency.
- Administrative management of intelligence records and ingestion jobs.
- A professional dashboard with investigation-oriented UX.

## Supported chains

Build the architecture to support these chain identifiers:

- `TRON`
- `ETHEREUM`
- `BSC`

For the initial live implementation, prioritize **TRON**. The other chains must have validation and adapter interfaces, and may be enabled when providers are configured. Never label a chain fully supported if its transaction provider is not configured.

## Supported asset scope

- USDT on TRON (TRC-20)
- USDT on Ethereum (ERC-20)
- USDT on BNB Smart Chain (BEP-20)

Keep token contract addresses in chain configuration, not scattered through business logic. Verify addresses against official issuer documentation before enabling a live chain.

---

# 2. Technology stack (JavaScript only)

## Frontend

- React
- Next.js (App Router)
- JavaScript + JSX
- Tailwind CSS
- Lucide React icons
- React Flow (`@xyflow/react`) for investigation graphs
- TanStack Query for server-state caching and request lifecycle
- Zustand only if shared client state genuinely requires it
- React Hook Form + Zod for form validation (JavaScript schemas)
- Recharts for charts if useful
- Vitest + React Testing Library

## Backend

- Node.js LTS
- Express
- JavaScript ES modules
- MongoDB Atlas or local MongoDB
- Mongoose
- Zod for request/environment validation
- JWT access tokens + refresh-token strategy
- bcrypt/bcryptjs for password hashing
- Helmet
- CORS with explicit allowed origins
- express-rate-limit
- pino (or another structured logger)
- Swagger/OpenAPI documentation
- Jest or Vitest + Supertest

## Tooling

- npm workspaces
- ESLint
- Prettier
- GitHub Actions
- Docker / Docker Compose for local MongoDB and optional app services
- Vercel for frontend deployment (optional)
- Render/Railway/Fly.io for Express backend (choose and document one deployment path)

Use compatible stable versions. Avoid unnecessary libraries and dependency duplication.

---

# 3. Repository layout

Create and maintain a structure similar to:

```text
chainguard/
├── README.md
├── .gitignore
├── .editorconfig
├── .prettierrc
├── package.json                  # npm workspaces + root scripts
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATA_SOURCES.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   ├── RISK_MODEL.md
│   └── OPERATIONS.md
├── client/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── app/
│       │   ├── layout.jsx
│       │   ├── page.jsx
│       │   ├── providers.jsx
│       │   └── queryClient.js
│       ├── assets/
│       ├── components/
│       │   ├── ui/
│       │   ├── layout/
│       │   ├── forms/
│       │   ├── feedback/
│       │   └── charts/
│       ├── features/
│       │   ├── auth/
│       │   ├── dashboard/
│       │   ├── screening/
│       │   ├── directory/
│       │   ├── investigation/
│       │   ├── history/
│       │   ├── profile/
│       │   └── admin/
│       ├── hooks/
│       ├── lib/
│       ├── services/
│       ├── stores/
│       ├── styles/
│       └── utils/
├── server/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── config/
│       │   ├── env.js
│       │   ├── database.js
│       │   ├── chains.js
│       │   └── providers.js
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       │   ├── screening/
│       │   ├── risk/
│       │   ├── investigation/
│       │   ├── intelligence/
│       │   └── ingestion/
│       ├── repositories/
│       ├── models/
│       ├── middleware/
│       ├── validators/
│       ├── adapters/
│       │   ├── blockchain/
│       │   ├── intelligence/
│       │   └── stablecoin/
│       ├── jobs/
│       ├── utils/
│       └── tests/
└── scripts/
    ├── seed-demo-data.js
    ├── import-intelligence.js
    └── verify-providers.js
```

Adapt as needed, but keep boundaries clear and avoid giant files.

---

# 4. Environment variables and credentials

Create **both** `client/.env.example` and `server/.env.example`. Explain each variable in `docs/DEPLOYMENT.md`.

## 4.1 Server environment

```dotenv
# Runtime
NODE_ENV=development
PORT=5000
API_PREFIX=/api/v1
APP_NAME=ChainGuard

# Frontend origin(s), comma-separated
CLIENT_ORIGIN=http://localhost:3000

# MongoDB (required)
MONGODB_URI=mongodb://127.0.0.1:27017/chainguard

# Authentication (generate secure random values; never use this example in production)
JWT_ACCESS_SECRET=replace_with_random_secret_at_least_32_bytes
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace_with_a_different_random_secret_at_least_32_bytes
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax

# Password/security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Blockchain provider (choose a provider; leave blank to use mock adapter)
TRON_RPC_URL=
TRON_API_KEY=
ETHEREUM_RPC_URL=
ETHEREUM_API_KEY=
BSC_RPC_URL=
BSC_API_KEY=

# Optional explorer/data providers
TRONSCAN_API_KEY=
ETHERSCAN_API_KEY=
BSCSCAN_API_KEY=

# Intelligence ingestion
INTELLIGENCE_INGESTION_ENABLED=false
INTELLIGENCE_USER_AGENT=ChainGuard/1.0 (contact: configure-your-contact)
INTELLIGENCE_SOURCE_TIMEOUT_MS=15000

# Optional issuer/provider integrations
TETHER_FREEZE_SOURCE_URL=
STABLECOIN_PROVIDER_API_KEY=

# Optional observability
LOG_LEVEL=info
SENTRY_DSN=
```

### Credential handling rules

- `MONGODB_URI`: MongoDB connection string. Use a dedicated database user with least-privilege permissions.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`: generate separately using a cryptographically secure random generator. Do not use the same secret.
- `TRON_RPC_URL`, `ETHEREUM_RPC_URL`, `BSC_RPC_URL`: provider endpoints. Some providers encode API keys inside the URL; keep the full URL server-side.
- `TRON_API_KEY`, `ETHERSCAN_API_KEY`, `BSCSCAN_API_KEY`, etc.: optional provider keys subject to provider plan and rate limits.
- Do not expose any provider key through a `NEXT_PUBLIC_*` variable.
- Do not commit `.env` files.
- Do not log secrets, authorization headers, cookies, or full credential-bearing URLs.
- Validate required variables at startup and fail with a clear, redacted error.
- Provide a script or documented command to generate secrets securely.
- In production, use the hosting provider's secret manager/environment settings.

## 4.2 Client environment

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_APP_NAME=ChainGuard
NEXT_PUBLIC_ENABLE_DEMO_MODE=true
```

Only public configuration belongs in `NEXT_PUBLIC_*` environment variables. **Anything with this prefix is exposed to the browser. Never put API secrets, JWT signing secrets, database credentials, or RPC credentials there.**

## 4.3 Services and credentials that may be needed

| Service | Purpose | Credential required? | Free/local fallback |
|---|---|---|---|
| MongoDB Atlas | Hosted database | Database URI/user | Local MongoDB via Docker |
| TRON RPC / TronGrid / TronScan | Wallet and transaction data | Depends on provider | Mock adapter + fixtures |
| Ethereum RPC | Ethereum data | Provider endpoint/key may be required | Mock adapter |
| BNB RPC | BSC data | Provider endpoint/key may be required | Mock adapter |
| Etherscan / BscScan | Explorer data | API key/plan may be required | RPC adapter where possible |
| Tether/issuer data | Freeze intelligence | Public source/provider dependent | Clearly labeled fixture records |
| OFAC | US sanctions | No API key for public downloads | Official public files |
| UN/EU/UK sources | Sanctions data | Source-dependent | Official public data/fixtures |
| Vercel | Frontend hosting | Account/deployment token for CI | Local Next.js |
| Render/Railway/Fly | Backend hosting | Account/deployment token for CI | Local Express |
| Sentry | Error monitoring | DSN | Structured logs |

**Do not invent official APIs.** Confirm each source's access method, terms, licensing, attribution requirements, update frequency, and rate limits. Record those details in `docs/DATA_SOURCES.md`.

---

# 5. Application pages and UI requirements

Build a polished, responsive, dark-first compliance dashboard. It should look like a serious investigation tool—not a generic admin template.

## 5.1 Global shell

- Sidebar navigation on desktop; responsive drawer on mobile.
- Top bar with page title, chain context, search, notifications/status, and profile menu.
- Clear active navigation state.
- Loading skeletons, empty states, error states, and success feedback.
- Keyboard-accessible controls, visible focus, semantic HTML, and adequate contrast.
- Consistent design tokens for spacing, typography, surfaces, borders, and risk colors.
- Use lucide icons consistently.
- Avoid excessive gradients, decorative animation, and fake data presented as live.

## 5.2 Dashboard

Route: `/dashboard`

Include:

- Total screenings (period filter).
- Critical/high/medium/low risk distribution.
- Recent screenings table.
- Recently flagged wallets.
- Source freshness and ingestion status.
- Screening volume chart.
- Quick wallet-screening form.
- Clear “demo data” indicator when fixtures are used.

All cards and charts must be backed by API responses. Do not hardcode dashboard numbers.

## 5.3 Wallet screening

Route: `/screen`

Form:

- Chain selector.
- Wallet address input.
- Optional transaction hash input.
- Optional investigation depth (default 1; maximum 2 in initial release).
- Submit button and validation.

Result view:

- Normalized wallet address and chain.
- Risk category and score.
- Clear verdict: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, or `UNKNOWN`.
- Evidence grouped by direct match, exposure, and behavior.
- Source name, record identifier, last updated timestamp, and confidence.
- Transaction exposure summary.
- Recommended next action.
- Data coverage/freshness disclaimer.
- Copy/share investigation reference (not sensitive tokens).
- Export result as JSON or PDF only if implemented and tested.

A negative result must say **“No known matches found in the configured sources”**, not “Safe wallet”.

## 5.4 Intelligence directory

Route: `/directory`

Features:

- Search by address, entity, label, source, or category.
- Filters for chain, category, risk level, source, and date.
- Server-side pagination and sorting.
- Wallet detail drawer/page.
- Evidence/source details.
- CSV export with limits and authorization.
- Empty state and reset filters.
- No unbounded collection downloads.

## 5.5 Investigation graph

Route: `/investigate/:screeningId` or `/investigate?address=...`

Use React Flow:

- Wallet nodes.
- Transaction edges.
- Direction arrows and transaction labels.
- Node color based on risk category.
- Click node to open wallet details.
- Fit view, zoom, pan, minimap, legend.
- Display hop number and traversal limit.
- Handle cycles, duplicate nodes, and missing counterparties.
- Graph must be based on actual retrieved transactions or labeled fixture data.
- Provide a tabular alternative for accessibility.

## 5.6 Screening history

Route: `/history`

- Current user's screening records only.
- Search/filter by address, chain, verdict, date.
- Pagination.
- Reopen a prior result.
- Delete an individual history item if policy permits.
- Do not store raw secrets or unnecessary personal data.
- Retention policy documented.

## 5.7 Authentication and profile

Routes:

- `/login`
- `/register`
- `/forgot-password` (only if email delivery is configured; otherwise clearly mark unavailable)
- `/profile`

Features:

- Register/login/logout.
- Password validation and secure hashing.
- Access token and refresh token flow.
- Refresh rotation and revocation.
- Profile display/update.
- Session expiry handling.
- Protected routes.
- No role or user ID accepted blindly from the client.

## 5.8 Admin

Routes under `/admin` and protected by server-side `ADMIN` role.

Features:

- User list and status management.
- Intelligence record CRUD/import.
- Ingestion job status.
- Source health and last successful update.
- Failed ingestion logs with safe error messages.
- Manual re-run for supported jobs.
- Audit trail for administrative mutations.
- No unrestricted arbitrary URL fetch input (prevent SSRF).
- No secret display in UI.

---

# 6. Data model

Use Mongoose models with validation, indexes, timestamps, and explicit field selection.

## 6.1 User

Fields:

- `name`
- `email` (normalized, unique)
- `passwordHash`
- `role`: `USER` or `ADMIN`
- `status`: `ACTIVE`, `SUSPENDED`
- `createdAt`, `updatedAt`
- `lastLoginAt`

Never return `passwordHash`.

## 6.2 IntelligenceRecord

Fields:

- `address`
- `chain`
- `category`: `SANCTIONED`, `FROZEN`, `SCAM`, `HACK`, `PHISHING`, `OTHER`
- `riskLevel`
- `entityName`
- `sourceId`
- `sourceName`
- `sourceUrl`
- `description`
- `confidence`
- `effectiveAt`
- `lastSeenAt`
- `ingestedAt`
- `rawReference` (safe source identifier, not arbitrary sensitive payload)
- `tags`
- `isActive`

Indexes:

- Unique compound index for normalized `chain + address + category + sourceId` where appropriate.
- Address/chain lookup.
- Category/risk filters.
- Source and freshness indexes.

## 6.3 Screening

Fields:

- `userId`
- `chain`
- `address`
- `verdict`
- `riskScore`
- `riskFactors`
- `matchedRecords`
- `exposureSummary`
- `behaviorSummary`
- `coverage`
- `providerStatus`
- `screenedAt`
- `durationMs`
- `version` (risk model version)

## 6.4 Transaction

Fields:

- `chain`
- `hash`
- `fromAddress`
- `toAddress`
- `token`
- `amount`
- `timestamp`
- `blockNumber`
- `status`
- `provider`
- `fetchedAt`

Use unique transaction hash + chain index. Avoid storing unnecessary transaction payloads.

## 6.5 RefreshSession

Fields:

- `userId`
- hashed refresh token or token identifier
- `expiresAt`
- `revokedAt`
- `createdAt`
- device/session metadata with privacy minimization

## 6.6 AuditLog

Fields:

- actor user ID
- action
- resource type/id
- timestamp
- safe metadata
- request correlation ID

Do not log passwords, tokens, or secrets.

---

# 7. Backend API contract

Prefix: `/api/v1`

Use a consistent response envelope:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": []
  },
  "requestId": "..."
}
```

Use appropriate HTTP status codes. Avoid returning stack traces in production.

## 7.1 Health

- `GET /health` — process health.
- `GET /health/ready` — database/provider readiness.

## 7.2 Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/forgot-password` (only if mail provider configured)
- `POST /auth/reset-password` (only if mail provider configured)

## 7.3 Screening

- `POST /screenings` — create screening.
- `GET /screenings/:id` — retrieve authorized screening.
- `GET /screenings` — current user's paginated history.
- `DELETE /screenings/:id` — delete own record if policy permits.
- `POST /screenings/:id/reinvestigate` — refresh investigation using current providers.

Request example:

```json
{
  "chain": "TRON",
  "address": "TExampleAddress...",
  "depth": 1
}
```

Response should contain verdict, score, evidence, source coverage, provider status, and investigation metadata.

## 7.4 Directory

- `GET /intelligence`
- `GET /intelligence/:id`
- `GET /intelligence/address/:chain/:address`

Support validated query parameters:

- `q`
- `chain`
- `category`
- `riskLevel`
- `source`
- `from`
- `to`
- `page`
- `limit`
- `sort`

## 7.5 Investigation

- `GET /investigations/:screeningId/graph`
- `GET /investigations/:screeningId/transactions`
- `POST /investigations/:screeningId/expand`

Enforce depth and request budgets server-side.

## 7.6 Dashboard

- `GET /dashboard/summary`
- `GET /dashboard/recent-screenings`
- `GET /dashboard/risk-distribution`
- `GET /dashboard/source-status`

## 7.7 Admin

- `GET /admin/users`
- `PATCH /admin/users/:id/status`
- `PATCH /admin/users/:id/role`
- `GET /admin/intelligence`
- `POST /admin/intelligence`
- `PATCH /admin/intelligence/:id`
- `DELETE /admin/intelligence/:id`
- `POST /admin/ingestion/:source/run`
- `GET /admin/ingestion/jobs`
- `GET /admin/audit-logs`

All admin endpoints require authenticated `ADMIN` authorization and audit logging.

---

# 8. Screening and risk engine

Implement the risk engine as pure, testable JavaScript functions independent of Express and MongoDB.

## 8.1 Input

- normalized chain
- normalized address
- direct intelligence matches
- issuer freeze match
- transaction exposure findings
- behavioral findings
- source coverage/freshness
- provider errors

## 8.2 Evidence categories

1. Direct sanctions match.
2. Issuer freeze match.
3. Direct scam/hack/phishing match.
4. Counterparty exposure.
5. Behavioral anomaly.
6. Unknown or incomplete source coverage.

## 8.3 Verdict rules

- Direct confirmed sanctions match → `CRITICAL`.
- Confirmed issuer freeze → `CRITICAL` or policy-defined high severity, with reason.
- Direct verified scam/hack evidence → `HIGH` or `CRITICAL` depending on source and policy.
- Exposure to risky counterparties → severity depends on exposure distance, value, and confidence.
- Behavioral indicators → additive risk; never equate a heuristic with a confirmed sanctions designation.
- Incomplete provider/source coverage → `UNKNOWN` or explicitly reduced-confidence verdict.
- No match with adequate coverage → `LOW`, labeled “No known matches in configured sources”; not a guarantee of safety.

## 8.4 Explainability

Every score must provide:

- factor name
- factor score/weight
- source/evidence reference
- confidence
- explanation
- timestamp
- risk model version

Avoid arbitrary scores without documented rationale. Document the scoring rules and limitations in `docs/RISK_MODEL.md`.

## 8.5 Determinism

Given the same normalized inputs and risk-model version, the risk engine must return the same result. Test this property.

---

# 9. Intelligence ingestion

Build a provider-neutral ingestion framework.

Each source adapter should implement a documented interface such as:

```js
{
  name,
  fetchRecords,
  normalizeRecord,
  validateRecord,
  getSourceMetadata
}
```

Pipeline:

1. Fetch source data with timeout and retry policy.
2. Validate response shape and content type.
3. Normalize chain/address/category.
4. Validate address formats.
5. Deduplicate.
6. Upsert into MongoDB.
7. Record ingestion status and source freshness.
8. Report created/updated/skipped/failed counts.
9. Store safe error details.
10. Respect provider/source terms and rate limits.

Support:

- Manual admin-triggered ingestion.
- CLI/script ingestion.
- Optional scheduled ingestion only when hosting supports it.
- No dependency on cron availability in the first deployment.
- Dry-run mode.
- Source-specific parser tests using fixture files.

Do not claim continuous updates if ingestion is only manual.

---

# 10. Blockchain provider architecture

Create chain adapters rather than coupling application services to one provider.

Example interface:

```js
{
  chain,
  validateAddress,
  normalizeAddress,
  getNativeBalance,
  getTokenTransfers,
  getTransaction,
  getAddressTransactions
}
```

Requirements:

- Provider timeouts.
- Retry only safe/idempotent requests.
- Rate-limit-aware behavior.
- Provider fallback where configured.
- Response normalization.
- No API key leakage.
- Explicit provider status (`LIVE`, `MOCK`, `UNAVAILABLE`).
- Fixtures for automated tests.

Implement a mock provider with deterministic data for demo mode. Clearly label it as simulated. The UI must show when blockchain data is simulated or unavailable.

Do not implement private-key management, wallet signing, or fund transfers. The application is read-only investigation software.

---

# 11. Security requirements

Implement and document:

- Password hashing with bcrypt/bcryptjs.
- JWT signing with strong secrets.
- Refresh-token rotation and revocation.
- Secure, HttpOnly cookies where appropriate.
- Strict CORS.
- Helmet security headers.
- API rate limiting.
- Request size limits.
- Input validation and normalization.
- MongoDB query sanitization.
- Protection against NoSQL injection.
- Server-side RBAC.
- Ownership checks for screening history.
- Safe error responses.
- Audit logging.
- Dependency vulnerability review.
- `.env` protection and secret redaction.
- SSRF protection in ingestion/admin functionality.
- No arbitrary user-controlled provider URL.
- No unsafe HTML rendering.
- Data minimization and retention.
- Clear privacy policy and disclaimer.

For production cookies, require HTTPS and secure cookie settings. Explain local-development exceptions.

---

# 12. Testing requirements

## Unit tests

- Address validation/normalization.
- Risk scoring.
- Evidence aggregation.
- Source normalization.
- Deduplication.
- Transaction graph construction.
- Pagination/filter parsing.
- Authorization helpers.

## Integration tests

- Register/login/refresh/logout.
- Screening creation and persistence.
- Screening ownership.
- Directory filters.
- Admin CRUD and role checks.
- Ingestion upsert/deduplication.
- Provider failure and timeout handling.

## Frontend tests

- Screening form validation.
- Loading/error/empty states.
- Risk result rendering.
- Directory filters.
- Protected route behavior.
- Graph rendering with fixture data.

## End-to-end smoke test

At minimum:

1. Start application.
2. Register/login.
3. Screen a fixture wallet.
4. View risk evidence.
5. Open investigation graph.
6. Search directory.
7. View history.
8. Logout.

Do not claim test coverage percentages unless measured by the test tooling.

---

# 13. UX and accessibility acceptance criteria

- Responsive from mobile (360px) to desktop.
- No horizontal overflow.
- Keyboard navigation works.
- Accessible form labels and error messages.
- Semantic headings.
- Adequate contrast.
- Risk colors accompanied by text/icons, not color alone.
- Skeleton/loading states.
- Empty states with useful actions.
- Error states with retry where appropriate.
- Toasts for mutations.
- Confirmation for destructive actions.
- Tables usable on mobile.
- Graph has a table/list fallback.
- Consistent design system.
- No placeholder buttons that do nothing.
- No fake live counters.
- No dead navigation links.

---

# 14. Deployment

Provide a complete local and production deployment guide.

## Local development

- Node.js LTS installed.
- npm installed.
- MongoDB local via Docker or MongoDB Atlas.
- Copy `.env.example` to `.env` in each app.
- Install dependencies from repository root.
- Seed labeled demo data.
- Start client/server with documented scripts.

Expected root scripts:

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
npm run seed
```

Provide additional scripts if needed:

- `npm run dev:client`
- `npm run dev:server`
- `npm run test:client`
- `npm run test:server`
- `npm run test:e2e`

## Production

Document:

- Frontend deployment.
- Backend deployment.
- MongoDB Atlas setup.
- Environment variables for each host.
- CORS configuration.
- Health check endpoints.
- Build/start commands.
- Database indexes.
- Seed/demo mode disablement.
- Log access and troubleshooting.
- Domain/HTTPS configuration.
- Provider API quotas and costs.

Avoid requiring a paid service for basic local execution.

---

# 15. README and developer documentation

Generate a user-facing root README with:

1. Product overview.
2. Screenshots (only actual screenshots).
3. Features.
4. Technology stack.
5. Architecture diagram.
6. Folder structure.
7. Local setup.
8. Environment variables.
9. API docs.
10. Testing.
11. Deployment.
12. Demo credentials only if generated locally and clearly marked.
13. Data-source limitations.
14. Security notes.
15. Roadmap.
16. License and attribution.

Also create:

- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/DATA_SOURCES.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/RISK_MODEL.md`
- `docs/OPERATIONS.md`

---

# 16. Definition of done

The project is not complete until all applicable items below are satisfied:

- [ ] JavaScript-only application source (`.js` / `.jsx`).
- [ ] No TypeScript source or `tsconfig.json`.
- [ ] Next.js frontend and Express backend run independently.
- [ ] MongoDB connection and models work.
- [ ] Authentication and server-side authorization work.
- [ ] Wallet screening flow works end-to-end.
- [ ] Risk engine is deterministic and tested.
- [ ] Evidence is shown for risk decisions.
- [ ] Directory search/filter/pagination works.
- [ ] Screening history is user-scoped.
- [ ] Investigation graph works with real or clearly labeled fixture data.
- [ ] Provider adapters and mock provider work.
- [ ] Ingestion pipeline is testable and idempotent.
- [ ] Admin functions are protected.
- [ ] Loading, error, empty, and success states exist.
- [ ] No nonfunctional controls.
- [ ] Secrets are not committed or exposed to the client.
- [ ] `.env.example` files are complete.
- [ ] API documentation is available.
- [ ] Tests pass.
- [ ] Lint passes.
- [ ] Production builds pass.
- [ ] Local setup is reproducible.
- [ ] Deployment guide is complete.
- [ ] Demo mode is explicitly labeled.
- [ ] README accurately reflects implemented features.

---

# 17. Codex execution instructions

Follow this order:

### Phase A — Inspect and plan
- Inspect the entire existing repository.
- Identify existing code, configuration, dependencies, and deployment setup.
- Compare current state against this specification.
- Create `docs/IMPLEMENTATION_PLAN.md` with milestones, dependencies, and risks.
- Do not delete existing work without justification.

### Phase B — Foundation
- Create workspace structure.
- Configure JavaScript, lint, formatting, environment validation, and scripts.
- Establish database connection, logging, and centralized error handling.
- Implement authentication and authorization.

### Phase C — Core domain
- Implement chain configuration and address validation.
- Implement provider adapters and fixtures.
- Implement intelligence models and ingestion.
- Implement deterministic screening/risk services.
- Implement screening APIs and history.

### Phase D — Frontend
- Implement dashboard, screening, directory, history, investigation, profile, and admin pages.
- Connect every page to backend APIs.
- Build loading/error/empty states.
- Make responsive and accessible.

### Phase E — Hardening
- Add tests.
- Add indexes and query limits.
- Add security controls.
- Add structured logging and provider health.
- Run test/build/lint commands and fix issues.

### Phase F — Documentation and final report
- Complete all docs and README.
- Provide a final report containing:
  - Features implemented.
  - Architecture and key decisions.
  - Files/modules created.
  - Environment variables requiring user configuration.
  - Providers that are live vs mocked.
  - Tests and exact results.
  - Build/lint status.
  - Known limitations.
  - Deployment steps.
  - Remaining tasks (if any).

## Final instruction

**Build the complete application, not just a plan.** Work incrementally, keep the project runnable at each milestone, and verify every critical flow. If a live external service requires credentials that are unavailable, finish the integration through a provider interface, provide a deterministic mock and fixture tests, and clearly document the exact credential/setup needed to activate it.
