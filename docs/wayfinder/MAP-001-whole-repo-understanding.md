# [MAP-001] Whole-repo understanding map

- **Label:** `wayfinder:map`
- **Status:** open
- **Tracker:** local-markdown (default)
- **Children:** [Repo topology and build/release model](tickets/001-repo-topology-and-build-release-model.md), [Domain vocabulary and tenancy model](tickets/002-domain-vocabulary-and-tenancy-model.md), [API architecture and module boundaries](tickets/003-api-architecture-and-module-boundaries.md), [Packages and cross-workspace contracts](tickets/004-packages-and-cross-workspace-contracts.md), [Web app architecture and flows](tickets/005-web-app-architecture-and-flows.md), [Messaging and notification pipeline end-to-end](tickets/006-messaging-notification-pipeline.md), [Data model and persistence](tickets/007-data-model-and-persistence.md), [Authn, authz, and identity](tickets/008-authn-authz-and-identity.md), [External integrations and providers](tickets/009-external-integrations-and-providers.md), [Infrastructure, deployment, and environments](tickets/010-infrastructure-deployment-and-environments.md), [Documentation landscape and durable understanding artifact](tickets/011-documentation-landscape-and-durable-artifact.md)
- **Durable artifact:** [`docs/ONBOARDING.md`](../ONBOARDING.md) (curated entrypoint; Wayfinder remains the evidence ledger)

## Destination

A durable, navigable understanding map of the whole Sanarwa repo (topology, domain, runtime architecture, data flows, and package boundaries) that a new contributor can use to orient and make changes confidently. Scope: **whole repo** (`apps/api`, `apps/web`, `packages/*`, infra, docs). End state: documented understanding, but this map work may also include refactors, fixes, and migrations where they help clarify, correct, or stabilize the system.

## Notes

- **Domain:** Sanarwa — multi-tenant notification platform (Tenant, Project, Subscriber, Channel, provider/BYOP, token-based sending). Source terms: `CONTEXT.md`, `ARCHITECTURE.md`.
- **Stack (known):** pnpm monorepo + Turbo; `apps/api` NestJS 11 + TypeORM 0.3 + BullMQ 6 + Postgres/Redis; `apps/web` TanStack Start + React; packages `api-client`, `sdk`, `ui`, `assets`, `config`, `shared-types`, `mcp`.
- **Skills every session should consult:** `codebase-design` (when discussing module/interface/seam/depth), domain context in `CONTEXT.md`/`ARCHITECTURE.md`. No `GLOSSARY.md` in repo.
- **Standing preferences:** understanding-first (decisions and documented findings), but refactors, fixes, and migrations are in scope when useful. Refer to maps/tickets by name. Record each resolution as a context pointer here (gist + link) with detail living in the ticket.

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [Repo topology and build/release model](tickets/001-repo-topology-and-build-release-model.md): pnpm@10.25/Turbo monorepo (2 apps, 7 packages) with oxlint+oxfmt/Vitest gates, CI jobs incl. migrations/containers, Docker full-stack and dev-infra compose; notable script/CI/doc drift.
- [Domain vocabulary and tenancy model](tickets/002-domain-vocabulary-and-tenancy-model.md): Tenant→Project→(ApiKey/ProviderConfig) scope, member roles, Subscriber vs Recipient, 8-channel enum with subsets, ProviderOrchestrator BYOP-before-managed, token billing/pricing; key doc-vs-code divergences recorded.
- [API architecture and module boundaries](tickets/003-api-architecture-and-module-boundaries.md): NestJS 11 modular monolith (global guards/interceptors/ValidationPipe, Better Auth+JWT/API-key, TypeORM/Postgres, BullMQ/Redis) with module map across identity/tenancy, messaging-notifications, providers, campaigns/workflows, billing/quotas, MCP and core flows.
- [Packages and cross-workspace contracts](tickets/004-packages-and-cross-workspace-contracts.md): `api-client` (session/tenant web client) vs `sdk` (public API-key client)+`mcp`, plus `ui`/`assets`/`config`/`shared-types`; source-exported internal pkgs vs dist-published external pkgs and app/external boundaries.
- [Web app architecture and flows](tickets/005-web-app-architecture-and-flows.md): TanStack Start/Router (file-based routes→pages), root provider stack (query/theme/auth/tenant/branding/monitoring), `/$tenantSlug/*` tenant UX with slug sync, mixed React Query+direct `api-client` data flows, and noted stability issues (double `TenantProvider`, auth hook bugs/stubs, route duplication).
- [Messaging and notification pipeline end-to-end](tickets/006-messaging-notification-pipeline.md): multiple ingress/orchestration paths (unified queued, engine direct,), BullMQ queues/processors, provider orchestrator (BYOP/managed chains/circuit/billing), templates/campaigns/workflows, consent/preferences/topics/inbox/erasure touchpoints, and tracked behavior-drift/failure/retention concerns.
- [Data model and persistence](tickets/007-data-model-and-persistence.md): TypeORM/Postgres with explicit entities+migrations (drift risks), tenant/project scoping patterns, core aggregates (messages/deliveries/events/logs/inbox, campaigns/workflows, tokens/billing/quotas, providers/preferences/topics), Redis/BullMQ coordination, and retention/erasure gaps (partial compliance erase, suppression/identity issues).
- [Authn, authz, and identity](tickets/008-authn-authz-and-identity.md): Better Auth mounted at `/api/auth` (session/org plugin, tenant/member mirroring) with global session guard, parallel JWT/credential flow, dual API-key guards and Better Auth-backed key service, tenant-member/org scoping and doc/implementation drift.
- [External integrations and providers](tickets/009-external-integrations-and-providers.md): channel adapters/BYOP (orchestrator + `ProviderService`), tenant-scoped inbound email webhooks and other provider callbacks (with security gaps), outbound tenant webhooks dispatch/retry, Bachs billing/webhook flow and constraints, and dual MCP surfaces (API-hosted vs `packages/mcp`).
- [Infrastructure, deployment, and environments](tickets/010-infrastructure-deployment-and-environments.md): Docker/compose full-stack and dev-infra topology, env/config validation and drift, API bootstrap/runtime deps (Postgres/Redis/BullMQ, migrations-on-boot), CI jobs/gates and missing-script drift, logging/metrics/health/alerting gaps, and inbound-email runbook coverage.
- [Documentation landscape and durable understanding artifact](tickets/011-documentation-landscape-and-durable-artifact.md): mapped doc roles/sources of truth and major drift (auth, rules/CI/env/contracts/baselines/snapshots), and produced `docs/ONBOARDING.md` as the curated onboarding artifact with maintenance guidance.

## Ticketed (open)

<!-- frontier tickets ready to work; detail lives in each ticket -->

- _(none — tickets [001]–[011] resolved; durable onboarding artifact produced at `docs/ONBOARDING.md`)_

## Not yet specified

<!-- in-scope fog you can't ticket yet; graduates as the frontier advances -->

- _(none currently ticketed as fog — follow-on work is to execute prioritized fixes/refactors/migrations surfaced by [005]–[011] and keep `docs/ONBOARDING.md`/intent docs reconciled with code)_

## Out of scope

<!-- work ruled beyond the destination; closed, never graduates -->

- Feature work unrelated to understanding, correcting, or stabilizing the current system.
- Making CI/gates green or cleaning baseline failures except insofar as understanding them matters or a scoped fix is warranted.
- Product/roadmap prioritization beyond what is needed to explain the current system.
