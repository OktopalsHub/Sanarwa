# Sanarwa Onboarding (Durable Understanding Guide)

> **Status:** curated contributor entrypoint.  
> **Last verified:** 2026-11-10 (based on Wayfinder [MAP-001] tickets [001]–[011], repo config/code spot checks, and targeted verification in this session).  
> **Precedence:** if this conflicts with code, CI config, migrations, or measured command output, trust the evidence and update this file. Wayfinder remains the research/evidence ledger; this file is the maintained summary.

## 1. Start here

**Sanarwa** is a multi-tenant notification/billing platform (NestJS API + Vite-only web SPA + shared packages) for sending and tracking messages across channels with tenant/project scoping, provider/BYOP routing, and token-based metering.

**Read-first path**

1. This file (`docs/ONBOARDING.md`)
2. [`CONTEXT.md`](CONTEXT.md) — domain vocabulary (**note:** its “no Better Auth” claim is stale; see [008], [011])
3. [`ARCHITECTURE.md`](ARCHITECTURE.md) — stack/seams (**note:** auth/tooling/known-state drift exists; reconcile with Wayfinder)
4. [`docs/wayfinder/MAP-001-whole-repo-understanding.md`](docs/wayfinder/MAP-001-whole-repo-understanding.md) — deep subsystem map and evidence
5. Before changing code: [`AGENTS.md`](AGENTS.md), [`CODING_STANDARDS.md`](CODING_STANDARDS.md), [`SENIOR-DEV-RULES.md`](SENIOR-DEV-RULES.md), [`DESLOP.md`](DESLOP.md) (treat availability/claims as verify-first; `.agents/rules` and `.cursor/rules` are absent in this checkout)

**Do not trust blindly:** README endpoint/env examples, comparison/task snapshots (`ntfy-sanarwa.md`, `NTFY-SARAWA-SUMMARY.md`, `notifkit-sanarwa.md`, task notes), and unmeasured gate/baseline claims.

## 2. Source-of-truth index

| Topic                              | Canonical now                                                                                                        | Supporting                                       | Trust notes                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Domain vocabulary                  | `CONTEXT.md`, channel/token enums/entities, [Wayfinder 002]                                                          | `PRODUCT.md`, `README.md`                        | Auth portion of `CONTEXT.md` is stale.                                        |
| Repo topology/build/CI/infra       | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.github/workflows/ci.yml`, `docker-compose*.yml`, [001], [010] | `AGENTS.md`, `ARCHITECTURE.md`                   | CI runs lint + fmt:check, type-check, test, build, containers, migrations.    |
| API architecture/modules           | `apps/api/src/main.ts`, `app.module.ts`, modules, [003]                                                              | `ARCHITECTURE.md`                                | Overlapping seams exist.                                                      |
| Packages/contracts                 | `packages/*` manifests/exports/READMEs, [004]                                                                        | app imports                                      | `api-client` (session/tenant, source) vs `sdk`/`mcp` (API-key/dist).          |
| Web app                            | `apps/web` routes/lib/contexts, [005]                                                                                | `README.md`                                      | Mixed query/direct API patterns and known stability issues.                   |
| Messaging pipeline                 | [006], messaging/notifications/provider/queue code                                                                   | snapshots                                        | Multiple send/dispatch paths and delivery-executor drift.                     |
| Data model/persistence             | [007], `apps/api/src/common/database/data-source.ts`, entities/migrations                                            | `ARCHITECTURE.md`                                | Fresh `migration:run` validated; retention/erasure/idempotency still open.    |
| Authn/authz/identity               | [008], `apps/api/src/main.ts`, `modules/auth/better-auth.ts`, guards/api-key modules                                 | `CONTEXT.md`/`ARCHITECTURE.md` (stale in places) | Better Auth mounted at `/api/auth`; hybrid flows and guard duplication exist. |
| Integrations/providers/billing/MCP | [009], provider/billing/webhook/mcp modules, `apps/api/src/modules/billing/PROVIDER-AUDIT.md`                        | `env.md`, `.env.example`                         | BYOP/managed rules and webhook security vary by surface.                      |
| Inbound email ops                  | `docs/INBOUND-EMAIL-PRODUCTION.md`                                                                                   | inbound controller/script                        | Requires `INBOUND_EMAIL_SECRET`, signed relay, deploy/migrations.             |
| Campaign/workflow extension        | `docs/EXTENSIBILITY-CAMPAIGNS-WORKFLOWS.md`                                                                          | [006]                                            | Seams documented; some features deferred.                                     |

**Wayfinder tickets:** [001](docs/wayfinder/tickets/001-repo-topology-and-build-release-model.md)–[011](docs/wayfinder/tickets/011-documentation-landscape-and-durable-artifact.md) (all resolved). Treat as evidence; promote stable conclusions here/intents docs deliberately.

## 3. Repository shape

- **Package manager:** pnpm (`packageManager: pnpm@10.25.0`), monorepo via `pnpm-workspace.yaml` (`apps/*`, `packages/*`), tasks via Turbo (`turbo.json`).
- **Apps**
  - `apps/api` (`@sanarwa/api`): NestJS 11, TypeORM 0.3, BullMQ 6, Postgres/Redis; HTTP under `/api/v1` (with unversioned exclusions), Better Auth mounted at `/api/auth`.
  - `apps/web` (`@sanarwa/web`): plain Vite + React 19 SPA (TanStack Router in file-based routes; no TanStack Start/Nitro/SSR), served statically with SPA fallback (`dist/`), React Query, consumes `@sanarwa/api-client`, `@sanarwa/ui`, `@sanarwa/assets`, `@sanarwa/shared-types`.
- **Packages:** `api-client` (internal web/session-tenant client), `sdk` (public API-key client, dist), `mcp` (MCP server, dist/bin), `ui`, `assets`, `config` (tsconfig presets), `shared-types` (source-exported contracts).

## 4. Domain model (mental map)

- **Tenancy:** `Tenant` (root org/billing/data scope) → `Project` → `ApiKey` and `ProviderConfig` (project-scoped in storage; tenant derivation/scoping patterns vary — verify per path). `TenantMember` links user to tenant with roles (`owner/admin/member/viewer`).
- **Identity/addressing:** `User`/member are app identities; `Subscriber` is a subscriber/inbox/topic identity (often string id, may relate to `userId`); `Recipient` is send-time channel address/target.
- **Channels:** canonical `NotificationChannel` = `email|sms|push|whatsapp|in_app|voice|webhook|chat` (`common/enums/notification-channel.enum.ts`), with derived subsets (core/billable/public-send/engine support differ by surface).
- **Providers:** external delivery adapters behind channel seams. **Managed** = platform credentials; **BYOP** = tenant-supplied (encrypted config), resolved before managed fallback in orchestrator paths; chat/WhatsApp BYOP-only by design in key paths (verify). Managed chains and eligibility are channel/provider-specific.
- **Billing:** token-based metering (not currency), managed vs BYO rates, welcome grant and token ledger/purchases (Bachs integration; off-session charging/subscription constraints noted in code/audits).
- **Messaging concepts:** messages/deliveries/logs/events/inbox items, templates, topics/subscriptions, preferences/suppressions/quiet-hours, campaigns, workflows, quotas.

## 5. Architecture highlights

### 5.1 API (`apps/api`)

- **Bootstrap (`src/main.ts`):** Nest app with `bodyParser: false`; env validation; security/CORS/compression; mounts Better Auth handler at `/api/auth` **before** body parsing; JSON/urlencoded (1MB, raw body capture for billing/webhook paths) + cookies; global `ValidationPipe` (whitelist/forbid/transform); global prefix `api/v1` excluding unversioned routes (`/`, `/metrics`, `/docs`, `/mcp`); Swagger in non-prod.
- **Cross-cutting (`app.module.ts`):** global `ThrottlerGuard` + session `AuthGuard`, interceptors (metrics/logging/audit/error/error-alerting), correlation middleware, TypeORM/Postgres, BullMQ, Redis, config modules.
- **Identity/auth ([008]):** Better Auth session/org plugin and tenant/member mirroring; global session guard resolves Better Auth session; machine API-key flows (Better Auth-backed key service, duplicate guard implementations with differing behavior); tenant/member guards/context. Custom JWT/credential auth paths also exist — treat auth as hybrid and verify per route.
- **Messaging/delivery ([006]):** multiple ingress paths (unified queued send/idempotency/fallback, engine direct, transport controllers, inbound ingest) feed engine/queue/provider seams; BullMQ queues/processors, delivery execution, provider orchestrator (BYOP/managed, circuit/billing), webhooks/feedback, campaigns/workflows automation, preferences/topics/inboxes.
- **Persistence ([007]):** explicit TypeORM entities/migrations registry, `synchronize: false`, `migrationsRun: true` on boot; heterogeneous ID/base patterns and scoping/erasure/retention/idempotency concerns documented in [007].
- **Integrations ([009]):** channel adapters, BYOP config encryption/validation, inbound provider/billing webhooks (verification quality varies), outbound tenant webhook dispatch/retry, Bachs billing flow, API-hosted MCP and `packages/mcp`.

### 5.2 Web (`apps/web`) ([005])

- Vite SPA file-based routes (`src/routes`) → page components (`src/pages`) and feature components (`src/components/*`). Served as static `dist/` with SPA fallback (`apps/web/nginx.conf` in Docker; `vite preview` locally).
- Root provider stack: query, theme, Better Auth client-backed auth, tenant, branding, monitoring, etc. Tenant-scoped UX primarily under `/$tenantSlug/*` with slug sync/canonicalization; parallel root routes exist.
- Data access: mix of React Query hooks and direct `@sanarwa/api-client` (generic/domain) calls; tenant context syncs `apiClient` tenant scope.
- **Known issues (not all fixed):** auth query-hook contract/implementation bugs and stubs, route duplication and `useTenant` ambiguity, placeholder session helpers, etc. (see [005]). Duplicate `TenantProvider` mount in tenant guard was removed in this session.

### 5.3 Queues/runtime deps ([006], [010])

- PostgreSQL (TypeORM), Redis (cache/throttle/circuit/coordination + BullMQ backend), BullMQ queues including notification/admin/delivery and webhook-retry queues.
- API startup runs migrations automatically (`migrationsRun: true`); consider operational implications for multi-instance deploys.

## 6. Local development and environments

> Verify exact ports/URLs against the mode you run; docs and defaults drift.

| Mode              | How                                                                                                                         | API                                                                         | Web                                                                           | Postgres                            | Redis                               | Notes                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full Docker stack | `pnpm deploy:local` or `docker compose up --build` (`docker-compose.yml`)                                                   | host `http://localhost:9010` (container 9000), API base typically `/api/v1` | `http://localhost:3000` (`VITE_API_URL` build arg/runtime points to host API) | `5432` (container), db `sanarwa_db` | `6379`                              | Compose sets dev-ish API env and local secrets; web depends on API started (not health-checked).                                                         |
| Dev infra only    | `pnpm infra:up` / `pnpm infra:down` (`docker-compose.dev.yml`) or `docker compose up postgres redis` (`docker-compose.yml`) | run API locally                                                             | run web locally                                                               | `5441` via dev compose, else `5432` | `6391` via dev compose, else `6379` | `AGENTS.md` notes `docker-compose.dev.yml` tracking confusion; file exists in this checkout. Align `DATABASE_URL`/`REDIS_URL` and app ports accordingly. |
| Bare dev          | `pnpm dev` (web + api via Turbo)                                                                                            | default `3000` unless env overrides                                         | Vite dev (commonly `3000`/configured)                                         | external/local                      | external/local                      | Ensure `VITE_API_URL`, CORS/origins, auth callback/base URLs, and `TRUSTED_ORIGINS` match.                                                               |

**Bootstrap**

```bash
pnpm install
# ensure Postgres/Redis reachable for chosen mode
pnpm --filter @sanarwa/api build
pnpm --filter @sanarwa/api migration:run
pnpm dev
```

**Minimum API env (boot validation expects, among others):** `DATABASE_URL`, `REDIS_URL`, `JWT_AUTH_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `PROVIDER_ENCRYPTION_KEY` (32 chars). See `apps/api/.env.example`, `.env.example`, `env.md` for broader provider/billing/MCP/webhook vars (drift exists).

## 7. Commands, CI, and verification

**Root scripts (`package.json`)**

- `pnpm lint` / `pnpm lint:all` / `pnpm lint:fix`
- `pnpm fmt` (write) / `pnpm fmt:check`
- `pnpm type-check`, `pnpm test`, `pnpm build`
- `pnpm dev`, `pnpm deploy:local`, `pnpm infra:up`, `pnpm infra:down`

**Not present as root scripts:** `deps:circular`, `fallow`, `fmt:fix` (use `fmt`/`fmt:check`). Do not re-add no-op CI stubs for missing tools.

**CI (`.github/workflows/ci.yml`):** lint + `fmt:check`, type-check, test, build, container builds, and migration run/revert/run against Postgres 16.

**Baseline snapshot (2026-11-10; re-verify before relying):**

- Fresh API `migration:run` on empty Postgres: green (validated against scratch replay + existing-env clone; see `docs/DATABASE-MIGRATIONS-ROLLOUT.md`; rollout/baseline/rollback runbook lives there)
- `build` / API type-check: previously green; re-measure after local WIP
- Web monitoring tests: React duplicate-copy failures addressed via pnpm `react`/`react-dom` overrides to `19.3.1`
- Lint-warning debt in web/packages remains; do not treat `--quiet` lint as warning-free

**Verification discipline:** run and report actual results; do not claim gates green against a known-red baseline.

## 8. Key flows and extension points

- **Send/delivery ([006]):** ingress normalization/auth/scope → consent/quiet-hours/quota/storage policy → persist message/delivery/log context → queue/engine execution → provider orchestrator (BYOP/managed/circuit/billing) → status/event projection and feedback webhooks; inbound email via signed `POST /notifications/inbound`.
- **Campaigns/workflows:** see `docs/EXTENSIBILITY-CAMPAIGNS-WORKFLOWS.md` and [006] for seams (audience/follow-up handlers, step handlers, durable waits/retries/signals) and deferred capabilities.
- **Providers/BYOP ([009]):** encrypted project-scoped provider configs, orchestrator-managed chains/factories, inbound/outbound webhook surfaces, Bachs billing webhooks/idempotency with documented constraints.
- **Erasure/retention ([007]):** subscriber erasure and inbox-erase seams exist but cross-store coverage/compliance paths are incomplete in places; retention policies/jobs have gaps.

### 8.1 Webhook operations (SMS/voice)

- SMS policy: **Africa → Africa's Talking**, **others → Telnyx** (default/managed), with **Twilio/Termii/Infobip webhooks enabled for BYOP**. Telnyx SMS/voice require Ed25519 verification (`TELNYX_PUBLIC_KEY`, raw body, fail-closed). Africa's Talking requires shared secret (`AFRICASTALKING_WEBHOOK_SECRET`, fail-closed). Twilio verifies with global `TWILIO_AUTH_TOKEN` when configured (otherwise accepted with warning for BYOP/global-route compatibility); Termii/Infobip support optional shared-secret verification (`TERMII_WEBHOOK_SECRET`/`INFOBIP_WEBHOOK_SECRET`). Generic SMS status routes known providers only. See `docs/SMS-VOICE-WEBHOOKS-PRODUCTION.md`.

## 9. Known drift, gaps, and prioritized fix areas

- **Docs/auth:** reconcile `CONTEXT.md`/`ARCHITECTURE.md`/`README.md`/`AGENTS.md` with actual Better Auth-hybrid identity model, contracts, env/topology, CI/scripts, and rule availability.
- **Messaging correctness:** unify overlapping send paths and engine-vs-executor delivery behavior; consolidate queue/DLQ/orchestrator ownership and status projections.
- **Data integrity/privacy:** migration registry hygiene (partially addressed), suppression/identity/erasure/retention completeness, DB+queue idempotency.
- **Security/integrations:** webhook verification gaps on some provider inbound controllers, `SMSWebhookController` registration concern, `ProviderService` scoping/cache bugs (alternate path), Bachs claim-vs-processing atomicity, outbound webhook event coverage.
- **Web stability:** auth/query-hook correctness, stubbed flows, route duplication, tenant/session helper semantics.
- **Ops:** migrations-on-boot strategy, health/readiness probes, metrics/auth/docs, env/compose alignment.

(Details and file-level grounding in [005]–[011].)

## 10. Maintenance protocol

- **Update this file in the same change** when altering: auth/bootstrap/routing, env/compose/ports, scripts/CI, channels/providers/billing semantics, schema/migrations, or key send/identity/pipeline flows.
- **Precedence:** prefer code/CI/migrations/measured output over docs; link to Wayfinder tickets for depth instead of duplicating large analyses.
- **Freshness:** keep `Last verified` current; date and scope any baseline/gate claims.
- **PR checklist prompt:** “What docs become stale because of this diff?” (especially auth, tenancy, delivery, billing, migrations, env, CI).
- **Instruction docs:** `AGENTS.md` and other root docs are untracked in this checkout and easy to lose; consider committing them deliberately.

## 11. Deep-dive index

- Map: [`docs/wayfinder/MAP-001-whole-repo-understanding.md`](docs/wayfinder/MAP-001-whole-repo-understanding.md)
- Tickets: [001](docs/wayfinder/tickets/001-repo-topology-and-build-release-model.md), [002](docs/wayfinder/tickets/002-domain-vocabulary-and-tenancy-model.md), [003](docs/wayfinder/tickets/003-api-architecture-and-module-boundaries.md), [004](docs/wayfinder/tickets/004-packages-and-cross-workspace-contracts.md), [005](docs/wayfinder/tickets/005-web-app-architecture-and-flows.md), [006](docs/wayfinder/tickets/006-messaging-notification-pipeline.md), [007](docs/wayfinder/tickets/007-data-model-and-persistence.md), [008](docs/wayfinder/tickets/008-authn-authz-and-identity.md), [009](docs/wayfinder/tickets/009-external-integrations-and-providers.md), [010](docs/wayfinder/tickets/010-infrastructure-deployment-and-environments.md), [011](docs/wayfinder/tickets/011-documentation-landscape-and-durable-artifact.md)
- Runbooks/guides: [`env.md`](env.md), [`docs/INBOUND-EMAIL-PRODUCTION.md`](docs/INBOUND-EMAIL-PRODUCTION.md), [`docs/SMS-VOICE-WEBHOOKS-PRODUCTION.md`](docs/SMS-VOICE-WEBHOOKS-PRODUCTION.md), [`docs/EXTENSIBILITY-CAMPAIGNS-WORKFLOWS.md`](docs/EXTENSIBILITY-CAMPAIGNS-WORKFLOWS.md)
- Integration audits: [`apps/api/src/modules/billing/PROVIDER-AUDIT.md`](apps/api/src/modules/billing/PROVIDER-AUDIT.md)
- Package docs: [`packages/sdk/README.md`](packages/sdk/README.md), [`packages/sdk/ENDPOINT-DRIFT.md`](packages/sdk/ENDPOINT-DRIFT.md), [`packages/mcp/README.md`](packages/mcp/README.md)
