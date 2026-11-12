# ChainGuard architecture

## Current repository state

This document describes the target architecture from the root [README](../README.md) and detailed [project specification](../PROJECT_SPECIFICATION.md). The foundation includes Next.js and Express workspaces, a responsive simulated dashboard, an address-format validation flow, baseline API middleware/health routes, and MongoDB connection configuration. Registration/login, bcrypt password hashing, refresh-session rotation/revocation, HttpOnly cookies, current-user lookup, role middleware, and client account screens are implemented. Domain models beyond users/sessions, provider integrations, screening persistence, and deployment remain.

## System context

```text
Browser (Next.js App Router)
  ├─ Next.js routes/layouts and accessible React UI
  ├─ TanStack Query API lifecycle/cache
  └─ Public NEXT_PUBLIC config only
          │ HTTPS / JSON, /api/v1
          ▼
Node.js + Express API
  ├─ request validation, auth, RBAC, ownership, rate limits
  ├─ screening/risk/investigation/intelligence services
  ├─ chain, issuer, and public-intelligence adapter interfaces
  ├─ structured logs, request IDs, safe errors, audit events
  └─ Mongoose repositories/models
          ├─ MongoDB (users, sessions, screenings, records, transactions, audit)
          ├─ Blockchain providers (TRON first; Ethereum/BSC only when configured)
          └─ Registered intelligence sources (manual ingestion initially)
```

## Workspace boundaries

- `client/`: Next.js App Router, React, JavaScript/JSX, Tailwind, Query, form validation, UI components and feature pages. Next.js owns page routing and layouts; it renders server results and status/uncertainty and does not compute authoritative scores or expose provider secrets. Use `NEXT_PUBLIC_*` only for values safe to expose to every browser.
- `server/`: Express app and server entrypoint, validated configuration, middleware, routes/controllers, domain services, repositories, Mongoose models, chain/source adapters, jobs, and server tests.
- `scripts/`: safe demo seeding, source import, and provider verification. Scripts use the same validation and adapters as the server where practical.
- `docs/`: API, architecture, data sources, security, deployment, risk policy, operations, implementation plan, feature tracker, and environment setup.
- Repository root: npm workspaces, shared scripts, formatting/linting configuration, Docker Compose, CI, and the source-of-truth README.

## Request flow

1. Express assigns a correlation/request ID, applies request-size, security-header, CORS, and rate-limit middleware, then parses the route input with Zod.
2. Authentication resolves the user from a short-lived access token/session. Protected services enforce role and record ownership on the server.
3. Controllers call domain services; services use repositories and adapter interfaces rather than reaching into Mongo or provider SDKs directly.
4. Screening normalizes chain/address, retrieves active intelligence and bounded transaction findings, computes a deterministic versioned risk result, and records coverage/provider state alongside evidence.
5. Repositories persist only necessary normalized data. Controllers return a consistent envelope and safe errors; logs omit secrets and sensitive headers.
6. The client fetches through API service functions and TanStack Query. It renders loading, empty, error, demo/live/unavailable, freshness, and coverage states from response metadata.

## Domain and persistence

The planned Mongoose collections are User, IntelligenceRecord, Screening, Transaction, RefreshSession, and AuditLog. Schemas will validate enumerations and normalized keys; indexes will support address/chain lookup, filtered/paginated directory searches, user-scoped screening history, source freshness, session expiration/revocation, audit chronology, and chain/hash transaction deduplication. Sensitive fields are excluded from normal model selection and responses. Screening records carry the risk model version and evidence references so historical results remain explainable.

## Provider and source architecture

Blockchain adapters expose chain identity, address validation/normalization, balance/transfer/transaction queries, and explicit `LIVE`, `MOCK`, or `UNAVAILABLE` status. Provider endpoints and credentials stay in server configuration. Calls have timeouts, safe retries, response normalization, rate-limit handling, and bounded request budgets. TRON is the first live target; Ethereum/BSC remain visibly unavailable until configured and verified. A deterministic fixture adapter supports local demos and tests.

Address validation currently normalizes TRON Base58Check and `41`-prefixed hex input to a lower-case hex lookup key. The checksum conversion follows [TRON's address encoding documentation](https://developers.tron.network/docs/encoding). Ethereum and BSC currently validate the 20-byte hexadecimal shape and normalize to lower-case; mixed-case EIP-55 checksums are not verified yet ([EIP-55](https://eips.ethereum.org/EIPS/eip-55)). These are address checks only and do not query or prove wallet activity.

Intelligence adapters expose source identity/metadata, fetch, normalize, and validate operations. The ingestion service applies content/shape checks, chain/address validation, deduplication, upserts, source freshness/job status, dry-run behavior, safe errors, and rate limits. Only allowlisted adapters may access their fixed sources; no user-supplied URL fetching is allowed. Initial runs are manual/CLI unless scheduled execution is deliberately added and documented.

## Risk and uncertainty

Risk scoring is a pure JavaScript domain module with a versioned policy. It consumes normalized direct matches, issuer freeze data, exposure, behavior, coverage, freshness, and provider outcomes. Each factor includes rationale, weight/score, source reference, confidence, and time. Direct confirmed sanctions and freeze evidence receive policy-defined high severity; heuristic behavior stays distinct from confirmed designations. Missing or stale coverage produces explicit uncertainty and can result in `UNKNOWN`. A negative lookup is worded “No known matches found in the configured sources,” never as a guarantee of safety.

## Authentication and authorization

Passwords are bcrypt-hashed. Access and refresh credentials use distinct server secrets. Refresh credentials are rotated and revocable, with only a hash or token identifier persisted. Cookie flags depend on environment, with Secure and HTTPS required in production. Every protected route checks authentication; admin routes also check ADMIN role; history and screening details enforce owner scope. Client-side route guards improve navigation but do not replace server authorization.

## Operational concerns

Health and readiness are separate: process health can succeed while Mongo/provider readiness is degraded. Logs are structured and correlated by request ID, with credential and personal-data redaction. Admin mutations produce audit records. Rate, pagination, export, graph-depth, body, and provider-time budgets are enforced server-side. Data retention, source attribution, provider terms, and operational run procedures are documented before production activation.

## Planned deployment

Local development uses npm workspaces, the Next.js development server, and local MongoDB via Docker Compose or an Atlas URI. The README suggests Vercel for the Next.js client and a documented Express host (Render/Railway/Fly) for the server; the specific backend path is to be selected and recorded during deployment work. Production uses managed secrets, MongoDB least privilege, HTTPS, explicit CORS origins, secure cookies, health checks, and disabled demo mode unless explicitly intended. This repository currently has no deployment setup.
