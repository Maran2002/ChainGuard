# ChainGuard

ChainGuard is a planned blockchain wallet screening and transaction risk intelligence platform. It is intended to help investigators assess wallet exposure to known sanctions, issuer freezes, scams, hacks, suspicious entities, and transaction behavior, with evidence and data coverage shown alongside each result.

## Project status

Foundation, identity, screening, and intelligence directory work are underway. The repository has a Next.js dashboard, screening flow, registration/login/profile pages, and a searchable intelligence directory with record details. Express provides auth, user-scoped screening, and protected directory APIs. Passwords are hashed and refresh sessions rotate in HttpOnly cookies. Dashboard metrics are labeled simulated. Screening returns an explainable UNKNOWN result when configured sources are incomplete; live providers and intelligence ingestion are not connected. MongoDB is required for accounts and persisted screening/directory records. The detailed requirements and acceptance criteria are preserved in [PROJECT_SPECIFICATION.md](PROJECT_SPECIFICATION.md).

## Planned technology

- **Frontend:** Next.js App Router, React, JavaScript, Tailwind CSS
- **Backend:** Node.js, Express, JavaScript ES modules
- **Database:** MongoDB with Mongoose
- **Domain features:** provider adapters, deterministic explainable risk scoring, screening history, intelligence search, and bounded investigation graphs
- **Testing/tooling:** JavaScript test tooling, npm workspaces, ESLint, Prettier, and GitHub Actions

The frontend and backend will remain separate workspace applications. The backend will own authentication, authorization, validation, screening decisions, provider access, and persistence. Provider credentials will remain server-side.

## Planned capabilities

- Screen TRON addresses first, with Ethereum and BNB Smart Chain support enabled only when their providers are configured.
- Show risk verdicts with evidence, confidence, provider status, source freshness, and coverage limitations.
- Search and filter an intelligence directory and review user-scoped screening history.
- Investigate transaction counterparties with a graph and accessible tabular alternative.
- Provide dashboard and administrative ingestion tools with server-side authorization.
- Offer clearly labeled deterministic demo data when live provider credentials are unavailable.

A negative lookup will be described as “No known matches found in the configured sources,” never as a guarantee that a wallet is safe.

## Repository guide

- [PROJECT_SPECIFICATION.md](PROJECT_SPECIFICATION.md) — complete product, architecture, API, security, testing, and deployment requirements.
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — phased delivery plan, dependencies, and readiness criteria.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — planned application boundaries and data flows.
- [docs/RISK_MODEL.md](docs/RISK_MODEL.md) — current deterministic score rules and limitations.
- [docs/FEATURE_TRACKER.md](docs/FEATURE_TRACKER.md) — implementation checklist; features remain unchecked until built and verified.
- [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md) — planned local and production configuration guidance.

## Getting started

Requirements: Node.js 20.9 or newer, npm, and Docker if you want local MongoDB. From the repository root:

```bash
npm install
docker compose up -d mongo
```

Copy `client/.env.example` to `client/.env.local` and `server/.env.example` to `server/.env`. Generate two different secrets with this command and set them as `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `server/.env`:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Then run:

```bash
npm run dev
```

The Next.js app uses `http://localhost:3000`; the API uses `http://localhost:5000`. The API can start without MongoDB but is not ready for persistent workflows until the database connects. Use `npm run build` and `npm run lint` for the current client and server checks. See the [environment setup guide](docs/ENVIRONMENT_SETUP.md) for variable handling and known limitations.

## Security and data limitations

ChainGuard is read-only investigation software; it will not manage private keys, sign transactions, or transfer funds. Live chain and intelligence data require verified providers and source access. The app must distinguish live, simulated, and unavailable data and must not imply that incomplete coverage establishes a wallet’s safety.
