# ChainGuard feature tracker

Status reflects work completed on 2026-11-12. A checkbox is marked only for an implemented foundation item; planned product behavior remains unchecked until it works and has been verified.

## Foundation and platform

- [x] JavaScript-only npm workspace with independent Next.js client/Express server apps and root scripts — Implemented; workspace install succeeds.
- [ ] Next.js App Router client with Tailwind, Lucide, TanStack Query, forms/Zod, optional chart/graph libraries — Partial: Next.js, Tailwind, Lucide, and TanStack Query are declared; form schemas, query provider, and graph/chart libraries remain.
- [ ] Express ES-module API and Mongoose/MongoDB connection — Partial: Express/Mongoose configured; database connection is attempted at startup, but no live Mongo instance was available to verify persistence.
- [ ] `.gitignore`, editor/format/lint configuration, CI workflow, Docker Compose — Partial: ignore/editor/format/lint and local Mongo compose are in place; CI workflow remains.
- [x] Request IDs, response envelope, safe centralized errors, structured logging, and baseline security middleware — Implemented for the initial API shell; domain and auth-specific controls remain.
- [ ] Health and database/provider readiness endpoints — Partial: process health route exists; readiness reports Mongo connection state, but live readiness was not verified because MongoDB is unavailable.
- [x] Responsive dark-first dashboard shell, design tokens, navigation, and mobile drawer — Implemented; visual dashboard data is explicitly simulated.

## Identity, permissions, and security

- [x] User model, normalized unique email, role/status, password hash and login metadata — Implemented; Mongo persistence not exercised because the local Mongo daemon is unavailable.
- [ ] Register, login, logout, refresh rotation/revocation, current-user endpoints — Partial: routes and refresh-token hashing/rotation are implemented; Mongo-backed flow remains unverified.
- [x] Bcrypt hashing, access/refresh secrets, HttpOnly cookie policy and expiry handling — Implemented; local ignored secrets generated, production requires HTTPS and secure cookies.
- [ ] Protected routes, profile display/update, server-side role and ownership checks — Partial: dashboard/screen routes check session; API authentication and ADMIN role middleware exist; profile editing and domain ownership checks remain.
- [ ] Admin USER/ADMIN authorization and audit trail for administrative changes — Not started
- [ ] Helmet, exact CORS, rate limiting, body limits, Zod validation, Mongo query sanitization — Partial: Helmet, exact origins, rate limits, body limits, and auth validation are in place; query sanitization remains.
- [ ] Safe errors/log redaction, SSRF prevention, no arbitrary fetch URL, no unsafe HTML — Partial: safe API envelopes, request IDs, header redaction, and reduced request logging are implemented; ingestion SSRF controls remain.
- [ ] Data minimization, screening retention/deletion policy, privacy/disclaimer — Not started
- [ ] Forgot/reset password only if email delivery is configured; otherwise unavailable state — Not started

## Chain and provider support

- [ ] Chain/address validation and normalization for TRON, Ethereum, and BSC — Partial: server validates TRON Base58Check/hex and EVM address shape, and normalizes lookup keys; live chain calls are not configured.
- [ ] Central chain and token contract configuration; official USDT address verification — Not started
- [ ] Adapter interface for balance, token transfers, transactions and address history — Partial: provider contract, deterministic fixture adapter, and explicit unavailable adapter exist; no live implementation.
- [ ] TRON live provider adapter with timeout, retry, rate-limit and status handling — Not started
- [ ] Ethereum and BSC adapter boundaries; visible unavailable state until configured — Not started
- [ ] Deterministic mock provider and visibly labeled fixtures — Partial: mock adapter is available behind `BLOCKCHAIN_PROVIDER_MODE=mock` and labels fixture-only output; it does not yet include transaction fixture records.
- [ ] Provider verification script and credential/setup documentation — Not started
- [ ] No wallet signing, private keys, or fund transfer functionality — Not started

## Intelligence and ingestion

- [ ] IntelligenceRecord schema, validation, explicit fields and lookup/filter/freshness indexes — Partial: schema, bounded list-query validation, search/filter/sort/pagination service, detail/address lookup, and baseline indexes are implemented; freshness index/query and Mongo verification remain.
- [ ] Source adapter contract, metadata, attribution, terms, licensing, update cadence and limits — Not started
- [ ] Official source adapters (sanctions, freezes, scams, hacks and other supported categories) — Not started
- [ ] Safe fetch/parse/normalize/validate pipeline, timeout/retry and source-specific fixtures — Not started
- [ ] Deduplication/upsert, dry run, created/updated/skipped/failed counts and job freshness — Not started
- [ ] CLI and protected manual admin ingestion; scheduled jobs only if explicitly configured — Not started
- [ ] Safe ingestion errors and SSRF-resistant allowlisted sources — Not started

## Screening, risk, and investigation

- [ ] Transaction model, unique chain/hash index and normalized transaction repository — Not started
- [ ] Pure deterministic versioned risk engine with transparent factor rationale/confidence — Implemented with thresholds, confidence, coverage, and uncertainty rules; unit tests pass.
- [ ] Direct sanctions, issuer freeze, scam/hack/phishing, exposure, behavior and coverage evidence — Not started
- [ ] Explicit UNKNOWN/incomplete coverage and freshness; no “safe wallet” claims — Not started
- [ ] Screening persistence with provider status, coverage, duration and model version — Partial: screening model/service saves those fields; MongoDB persistence is unverified here.
- [ ] Bounded counterparty investigation, exposure summaries and server-side request budgets — Not started
- [ ] Graph construction handles cycles, duplicates and missing counterparties — Not started
- [ ] Risk policy, evidence and limitations documented — Not started

## API and data workflows

- [ ] Auth endpoints and health/readiness endpoints under documented API contract — Not started
- [ ] Screening create/get/list/delete/reinvestigate; current-user scoping — Partial: validated endpoints and owner filters are implemented; database integration is unverified.
- [ ] Directory list/detail/address lookup, search, filters, server pagination/sorting — Partial: protected list/detail/address endpoints and responsive API-backed list/detail pages are implemented; Mongo-backed endpoint verification remains.
- [ ] Directory CSV export with authorization and limits — Not started
- [ ] Investigation graph/transactions/expand endpoints with traversal limits — Not started
- [ ] Dashboard summary/recent/risk distribution/source status endpoints — Not started
- [ ] Admin users/status/role and intelligence CRUD endpoints — Not started
- [ ] Admin ingestion jobs/run and audit-log endpoints — Not started
- [ ] OpenAPI/Swagger documentation and consistent response/error schema — Not started

## Frontend pages and UX

- [ ] Dashboard with API-backed counts, distribution, recent/flagged wallets, chart, source status, quick screen — Partial: responsive simulated dashboard implemented; backend API wiring remains.
- [ ] Screening form with chain/address/hash/depth validation and detailed evidence result — Partial: form validates address/hash/depth, calls the screening API, and renders verdict/coverage/evidence; saved results still require MongoDB and providers are unavailable.
- [ ] Result coverage/freshness disclaimer, next action, reference sharing and demo/provider label — Not started
- [ ] Directory search, filters, pagination, sorting, detail view, bounded CSV export — Partial: responsive search/filter/date-range/sort/pagination and evidence detail views are implemented; CSV export remains.
- [ ] Investigation graph with React Flow, legend/controls, hop labels and accessible table alternative — Not started
- [ ] User-scoped history with search/filters/pagination/reopen and policy-based deletion — Not started
- [ ] Login/register/logout, session expiry and protected navigation — Partial: login/register screens, session gate, refresh-aware current-user lookup, and API flow are implemented; Mongo-backed lifecycle needs integration verification.
- [ ] Profile view/update — Partial: profile view and logout are implemented; profile editing remains.
- [ ] Admin user, intelligence, source/job health and safe ingestion controls — Not started
- [ ] Loading skeletons, useful empty states, retryable errors, success feedback and destructive confirmation — Not started
- [ ] Mobile drawer/tables, keyboard focus, semantic labels, contrast and no horizontal overflow — Not started
- [ ] No dead buttons, fake live numbers, or unlabeled fixture data — Not started

## Verification, operations, and deployment

- [ ] Unit tests for validation, normalization, risk, evidence, ingestion, graph, query parsing, authorization — Partial: 22 auth/address/risk/screening/directory-query tests pass; ingestion, graph, and authorization suites remain.
- [ ] API integration tests for auth lifecycle, ownership, directory, admin, persistence, provider failures — Partial: three API health/readiness/origin middleware checks pass; Mongo-backed workflows remain untested.
- [ ] Frontend tests for validation, loading/error/empty/results/filters/protected routes/graph — Not started
- [ ] End-to-end smoke flow from login through screening, evidence, graph, directory, history, logout — Not started
- [ ] Dependency review; lint, test, and production build pass with exact results reported — Partial: client/server lint passes, all 22 current server tests pass, and the Next.js production build succeeds; dependency/security review plus broader client and Mongo integration tests remain.
- [ ] Complete client/server `.env.example`; secret generation and redaction guidance — Not started
- [ ] Local reproducible setup, MongoDB indexes, seed/demo setup and demo disablement — Not started
- [ ] Production deployment path, HTTPS/CORS/cookies, secret manager and health checks — Not started
- [ ] API, data source, security, risk, deployment, and operations documentation — Not started
- [ ] README reflects actual shipped behavior and limitations; no fabricated screenshots/credentials — Not started

## Current recommendation

Continue Phase E by implementing registered-source ingestion with dry-run, validation, deduplication, attribution, and safe manual execution. Then add the bounded investigation transaction/graph domain and wire the directory/history/dashboard to verified persisted data. The current environment still has no running MongoDB service or configured live provider credentials, so database-backed auth, screening, and directory flows need integration verification. Keep the dashboard visibly simulated and screening UNKNOWN until coverage is configured.
