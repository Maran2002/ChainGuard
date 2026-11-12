# ChainGuard implementation plan

## Baseline and scope

The detailed [PROJECT_SPECIFICATION.md](../PROJECT_SPECIFICATION.md) is the requirements source of truth; the root [README.md](../README.md) is the project overview. At initial inspection, the repository contained only the specification and Git metadata; there was no application code, dependency manifest, environment template, database setup, test suite, or deployment configuration. This plan tracks the full product scope and sequences work so each layer has a usable contract before dependent work begins.

## Architecture summary

Build a JavaScript-only npm workspace with a Next.js App Router client and a Node.js/Express API. The API owns validation, authentication, authorization, risk decisions, data-provider access, and persistence. MongoDB/Mongoose stores users, intelligence records, screenings, normalized transactions, refresh sessions, and audit events. Provider-neutral adapters isolate TRON, Ethereum, BSC, issuer, and public intelligence sources. A deterministic mock adapter and labeled fixtures support local development where live credentials or source access are unavailable. The client uses Next.js routing/layouts, TanStack Query, Tailwind, React Hook Form/Zod, Lucide, and React Flow for the graph; all operational data comes from API responses.

## Implementation phases

| Phase | Objectives and principal outputs | Dependencies / exit criteria |
|---|---|---|
| A. Inspection and planning | Preserve repository work; compare the README to the current tree; create this plan, architecture, feature tracker, and environment setup documentation. | Complete. This repository has no implementation to preserve beyond README. |
| B. Foundation — in progress | Create npm workspaces (`client`, `server`), JavaScript-only tooling, root scripts, env examples and startup validation, Express app/server, structured logging, request IDs, centralized errors, security middleware, Mongo connection, Docker Compose, Next.js App Router shell, design tokens, and CI. | Workspace, dashboard shell, address-format form, API process, environment examples, local Mongo compose, health/readiness routes, lint, and client build are in place. CI, database-backed readiness verification, TanStack Query provider, and source-backed dashboard data remain. |
| C. Identity and security — in progress | User and refresh-session models; registration/login/logout/refresh/me routes; password hashing; token rotation/revocation; cookie/session policy; protected client routes/profile; server-side USER/ADMIN checks; ownership checks; rate limits; audit primitives; privacy and retention decisions. | User/session models, register/login/logout/refresh/me endpoints, bcrypt, hashed rotating sessions, cookie controls, role middleware, auth pages, client session gate, and validation unit tests are implemented. Mongo-backed auth lifecycle verification, admin provisioning/audit, profile editing, and broader authorization coverage remain. |
| D. Chain and source adapters — in progress | Chain configuration and address normalization/validation for TRON, Ethereum, BSC; token contract configuration sourced from official issuer material before live enablement; blockchain adapter contract; deterministic mock and fixture provider; source registry, metadata and status; timeout/retry/rate-limit behavior; provider verification script. | Chain IDs and address format normalization are implemented; all provider adapters, token metadata verification, and source ingestion remain. A chain is labeled live only after its configured provider and token metadata are verified. |
| E. Intelligence and ingestion — in progress | IntelligenceRecord model and indexes; source adapter contract; safe source-specific fetch/parse/normalize/validate; dry-run, deduplication/upsert, status/freshness counts, safe errors, CLI and admin-triggered runs; source fixture tests and source terms/attribution documentation. | The record model, baseline indexes, bounded query validation, and protected directory list/detail/address APIs are in place. Source registry, ingestion, freshness tracking, attribution policy, and Mongo-backed verification remain. No arbitrary URL fetch; ingestion is explicitly manual unless scheduling is implemented. |
| F. Risk and investigation domain — in progress | Pure deterministic versioned risk engine; evidence aggregation and explainability; coverage/freshness uncertainty; transaction model/repository; exposure and behavior findings; bounded graph construction with cycles/duplicate handling; scoring policy and limitations docs. | A deterministic v1.0.0 score engine and risk-model doc are implemented and unit tested. Transaction persistence, provider-backed findings, and graph traversal remain. |
| G. Screening APIs and dashboard services — in progress | Validated screening create/read/list/delete/reinvestigate routes; user-scoped persistence; dashboard summary/recent/distribution/source status; directory search/detail/address routes with server pagination/sorting/limits; investigation graph/transactions/expand routes with server budgets; API documentation. | Screening create/history/detail/delete/reinvestigate and owner-scoped persistence are implemented; protected directory list/detail/address APIs are implemented with bounded query validation. Mongo-backed endpoint verification, dashboard data APIs, graph APIs, and broader API docs remain. |
| H. Frontend product flows — in progress | Responsive shell/nav; dashboard, screen/results, directory/detail/export, investigation graph plus accessible table, history, profile/auth, admin and ingestion management; API services/hooks; form and query validation; loading/empty/error/success states; keyboard/accessibility and mobile behavior. | Dashboard, screening form/results, authentication/profile, and directory list/detail views are implemented. Directory CSV export, investigation graph, history, admin/ingestion pages, frontend tests, and accessibility verification remain. |
| I. Hardening and verification | Unit, API integration, frontend, and end-to-end smoke tests; dependency review; query/index and request limits; safe logs/errors; accessibility/responsive pass; production builds; lint; provider and demo-mode verification. | Phases B–H. Report only checks actually run, with exact command/results. |
| J. Deployment and operations | Complete API/data-source/security/risk/deployment/operations documentation; production env validation, health/readiness, database indexes, deployment configuration and CI; reproducible local/demo setup; final README and limitations report. | Phase I. Local setup and selected deployment path are reproducible; secret handling, HTTPS, CORS, health checks, and demo-data labeling are documented. |

## Dependencies and boundaries

- The client never calculates authoritative risk, trusts client roles/IDs, or receives provider credentials. The server validates every API boundary and applies authorization on each protected operation.
- Screening depends on normalized chain/address, current intelligence and provider outcomes, and explicit source coverage. A missing provider/source is an uncertainty condition, not a clean result.
- Directory and screening history depend on bounded, indexed Mongo queries. User history is always scoped to the authenticated user; admin operations are independently role-checked and audited.
- Graph UI depends on a bounded graph API. A graph must identify live, fixture, or unavailable transaction data and have a table/list alternative.
- Data ingestion depends on verified source access, permitted use, attribution and rate limits. Public sanctions files and issuer data must not be represented as verified until source adapters are implemented and exercised.
- Deployment depends on production secrets, MongoDB, explicit client origins, HTTPS cookie settings, and provider configuration for any chain labeled live.

## Database and API requirements

Implement the README's User, IntelligenceRecord, Screening, Transaction, RefreshSession, and AuditLog models with schema validation, timestamps, explicit field selection, and query-supporting indexes. Normalize emails and chain/address keys. Enforce transaction uniqueness by chain/hash and appropriate intelligence deduplication by chain/address/category/source. Keep refresh credentials hashed or represented by revocable token identifiers; never select or serialize password hashes.

All endpoints live under `/api/v1` except the documented health endpoints. Return the documented success/error envelope and request ID. Validate path, query, and body inputs; cap pagination, graph depth, request size, exports, retries, and provider timeouts. Use correct HTTP statuses and avoid production stack traces. Protect auth, screening, history, directory, investigation, dashboard, and admin routes according to the README's ownership and role requirements.

## Security and privacy requirements

- Keep secrets server-side, out of source control, `NEXT_PUBLIC_*` configuration, browser bundles, logs, and error messages. Provide complete placeholder-only `.env.example` files.
- Validate required configuration on startup and redact credential-bearing URLs in errors/logging.
- Hash passwords with bcrypt/bcryptjs; use distinct strong access/refresh secrets; rotate and revoke refresh sessions; use HttpOnly/Secure/SameSite cookies as deployment requires.
- Apply Helmet, exact CORS origins, rate limiting, body limits, Zod validation, Mongo query sanitization, server-side RBAC/ownership, and centralized safe errors.
- Treat user data minimally; document screening retention and deletion behavior. Audit admin mutations without secrets or unnecessary personal data.
- Restrict ingestion to registered source adapters; never accept a user-controlled arbitrary fetch URL. Prevent SSRF and HTML injection.
- Make uncertainty, provider status, source freshness, and coverage visible. Never present a negative lookup as proof of safety.

## Testing requirements

The README calls for tests across address validation/normalization; deterministic risk and evidence; source normalization and deduplication; graph construction; pagination/filter parsing; authorization; auth lifecycle; screening persistence/ownership; directory filters; admin permissions/CRUD; ingestion idempotence; provider timeout/failure; and frontend form/results/filters/protected routes/graph. Include a smoke flow from registration/login through fixture screening, evidence, graph, directory, history, and logout. Use fixture data clearly labeled as simulated. Do not claim test coverage or successful commands without measuring/running them.

## Deployment readiness criteria

- JavaScript-only source and no `tsconfig.json`; reproducible npm workspace install and documented scripts.
- Complete client/server environment examples and startup validation; no real secrets committed.
- Mongo indexes and least-privilege connection documented; local Mongo option and demo seed path available.
- API health and readiness, production error/log behavior, explicit CORS, HTTPS and secure cookies configured.
- Client and server lint/tests/build pass with exact results recorded.
- Live and mock provider status are distinguished; chain enablement and token contract addresses are verified against official sources.
- API, security, risk model, source terms/freshness, operations, and chosen deployment steps documented.
- Demo mode can be disabled in production; sample data is visibly labeled and no fabricated live claims are made.

## Current phase recommendation

Continue Phase E: implement a registered-source ingestion pipeline with dry-run and idempotent upsert behavior, then proceed to transaction persistence and bounded graph investigation. The Next.js/Express workspace, authentication, screening APIs, deterministic risk engine, and directory list/detail flow are implemented. MongoDB is not currently running in this environment, and live provider/source credentials are not configured, so persistence integrations remain unverified and data must continue to show as simulated, incomplete, or unavailable. Confirm official issuer contract metadata and provider/source access before enabling live data.
