# [010] Infrastructure, deployment, and environments

- **Label:** `wayfinder:research`
- **Status:** closed (resolved)
- **Parent map:** [Whole-repo understanding map](../MAP-001-whole-repo-understanding.md)
- **Blocked by:** none (informed by [001])
- **Blocks:** none (informs fog graduation)

## Question

How is Sanarwa deployed and operated across environments — Docker/compose topology, env/config management, CI workflows and gates, observability/logging/metrics/alerting, runtime dependencies (Postgres/Redis/queues), and operational runbooks — stated clearly enough to navigate and change infra safely? If understanding reveals concrete correctness/stability issues, scoped fixes, refactors, or migrations may be included.

## Resolution

# Sanarwa infrastructure, deployment, and environments (ticket 010)

**Scope:** medium-thoroughness read-only research grounded in repository files. No files were modified and no git branches were created.

**Key sources read:** `docker-compose.yml`, `docker-compose.dev.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `.github/workflows/ci.yml`, `turbo.json`, `pnpm-workspace.yaml`, `package.json`, `apps/api/package.json`, `apps/web/package.json`, `.env.example`, `apps/api/.env.example`, `.dockerignore`, `docs/INBOUND-EMAIL-PRODUCTION.md`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/app.controller.ts`, `apps/api/src/common/http/api-prefix.ts`, `apps/api/src/common/database/data-source.ts`, `apps/api/src/config/{database,redis,logging,environment.validator}.ts`, `apps/api/src/common/middleware/security.middleware.ts`, `apps/api/src/common/logging/{logging.module,logger.config}.ts`, `apps/api/src/common/monitoring/{monitoring.module,metrics.controller,metrics.service}.ts`, `apps/api/src/modules/messaging/queue/{notification-queue.constants,notification-queue-core.module}.ts`, `apps/api/src/modules/analytics/queue/webhook-queue.module.ts`, `README.md`, `AGENTS.md`.

---

## 1. Deployment topology (Docker Compose)

### 1.1 Full-stack compose (`docker-compose.yml`)

| Service    | Image/build                              | Ports (host:container) | Notable env/config                                                                                                                                                                                                                                                                                        | Depends on                       | Persistence/health                                                                                             |
| ---------- | ---------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `postgres` | `postgres:16-alpine`                     | `5432:5432`            | `POSTGRES_USER=sanarwa`, `POSTGRES_PASSWORD=sanarwa`, `POSTGRES_DB=sanarwa_db`                                                                                                                                                                                                                            | —                                | `postgres_data:/var/lib/postgresql/data`; healthcheck `pg_isready -U sanarwa -d sanarwa_db` (5s/5s/20 retries) |
| `redis`    | `redis:7-alpine`                         | `6379:6379`            | —                                                                                                                                                                                                                                                                                                         | —                                | `redis_data:/data`; healthcheck `redis-cli ping` (5s/5s/20 retries)                                            |
| `api`      | build `apps/api/Dockerfile`, context `.` | `9010:9000`            | `NODE_ENV=development`, `PORT=9000`, `DATABASE_URL=postgresql://sanarwa:sanarwa@postgres:5432/sanarwa_db`, `REDIS_URL=redis://redis:6379`, `JWT_AUTH_SECRET`, `JWT_REFRESH_SECRET`, `PROVIDER_ENCRYPTION_KEY`, `SESSION_SECRET`, `CORS_ORIGIN`/`FRONTEND_URL`/`TRUSTED_ORIGINS=http://localhost:3000,...` | `postgres` + `redis` **healthy** | `restart: unless-stopped`; no container healthcheck defined                                                    |
| `web`      | build `apps/web/Dockerfile`, context `.` | `3000:3000`            | build arg + runtime env `VITE_API_URL=http://localhost:9010/api/v1`                                                                                                                                                                                                                                       | `api` **started** (not healthy)  | `restart: unless-stopped`; container `HEALTHCHECK` exists in Dockerfile but not in compose                     |

- Volumes: `postgres_data`, `redis_data` (`docker-compose.yml:70-72`).
- Local full-stack entrypoint: `pnpm deploy:local` → `docker compose up --build` (`package.json`).

### 1.2 Dev-infra-only compose (`docker-compose.dev.yml`, untracked per `AGENTS.md`)

- Purpose: Postgres + Redis only, pinned to locally cached images to avoid pulls; custom host ports to avoid collisions on multi-project machines.
- `postgres:16-alpine` → `localhost:5441:5432`, volume `sanarwa_postgres_data`, same credentials/db and pg_isready healthcheck, `restart: unless-stopped`.
- `redis:7-alpine` → `localhost:6391:6379`, volume `sanarwa_redis_data`, redis ping healthcheck, `restart: unless-stopped`.
- Usage documented in-file: `docker compose -f docker-compose.dev.yml up -d` then `pnpm --filter @sanarwa/api migration:run`.
- Root scripts: `pnpm infra:up` `pnpm infra:down` target this file (`package.json:16-17`). `AGENTS.md` notes this file is untracked, so fresh clones must use `docker compose up postgres redis` from root instead.

### 1.3 Container images

**API (`apps/api/Dockerfile`)**

- Multi-stage `node:22-alpine`, `corepack` + `pnpm@10.25.0`.
- `deps`: copies repo, `pnpm install --frozen-lockfile --filter @sanarwa/api...`.
- `builder`: copies `node_modules`, builds `@sanarwa/sdk` then `@sanarwa/api` (`pnpm --filter... build`).
- `runner`: `NODE_ENV=production`, copies `apps/api/dist`, `apps/api/package.json`, and full built `node_modules`; exposes `9000`; runs as `USER node`; `CMD ["node","dist/main.js"]`.
- **No image `HEALTHCHECK`**. Build context is repo root (`.`); `.dockerignore` excludes `.git`, `node_modules`, `dist`, `.output`, coverage, `.env*` except `!.env.example`, logs.

**Web (`apps/web/Dockerfile`)**

- Multi-stage `node:22-alpine`, `corepack` + `pnpm@10.25.0`.
- `deps`: `pnpm install --frozen-lockfile --filter @sanarwa/web...`.
- `builder`: `ARG/ENV VITE_API_URL=http://localhost:9000/api/v1` (note: compose overrides to `http://localhost:9010/api/v1`), `WORKDIR /app/apps/web`, `pnpm build`.
- `runner`: `NODE_ENV=production`, copies `.output`, exposes `3000`, runs as `USER node`.
- **Has `HEALTHCHECK`**: every 30s (`timeout 5s`, `start-period 20s`, `retries 3`) hitting `http://127.0.0.1:3000/` and requiring 2xx/3xx.
- Runtime/start: `node.output/server/index.mjs` (`apps/web/package.json` build/start via Vite/Nitro-style `.output`).

### 1.4 Deployment/environments model (observed)

- No `docker-compose.prod.yml`, no prod Dockerfile variants, no Kubernetes manifests, no Helm/Terraform, and no deployment workflow found in-repo (`.github/workflows` contains only `ci.yml`).
- `NODE_ENV` drives behavior in code (security/CORS/logging/migrations/docs/metrics auth); compose sets API to `development` even in the “full stack” docker scenario (`docker-compose.yml:37`).
- `README.md` describes architecture (API + workers/queues + Postgres + Redis) and local API usage examples; it does not document a production deployment procedure.

---

## 2. Environment and configuration management

### 2.1 Env files and examples (drift is significant)

| File                    | State/purpose                                                                                                        | Notes                                                                                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.example`          | Tracked, large/template-style template                                                                               | Default `PORT=3000`, `FRONTEND_URL=http://localhost:3001`, `DATABASE_URL` db name `notification_platform`, includes many provider/OAuth/billing/routing vars and extensive comments                                    |
| `apps/api/.env.example` | Tracked, API-focused template                                                                                        | Different defaults (`PORT=3000`, `FRONTEND_URL/WEB_ORIGIN/CORS_ORIGIN=http://localhost:3001`, db `sanarwa`), includes `API_PREFIX`, `MCP_*`, ZeptoMail/AWS/Telnyx/Bachs/`INBOUND_EMAIL_SECRET`, VAPID, OAuth callbacks |
| `apps/api/.env`         | **Present and untracked contextually risky** (`.dockerignore` excludes `.env*` from images, but file exists locally) | Real local config may live here; do not copy secrets into docs/commits                                                                                                                                                 |

`AGENTS.md`/`CONTEXT.md` note env expectations have drifted (e.g. Better Auth keys present but historically unused in some docs; `BETTER_AUTH_*` now relevant as `main.ts` mounts `betterAuthHandler` at `/api/auth`).

### 2.2 Config loading and validation

- **Bootstrap load:** `ConfigModule.forRoot({ isGlobal: true, load: [appConfig, redisConfig, queueConfig, jwtConfig, loggingConfig], validate, envFilePath: [".env.local", ".env"] })` (`apps/api/src/app.module.ts:66-71`).
- **Global env schema/validation:** `apps/api/src/config/environment.validator.ts`
- Validated via `class-validator`/`class-transformer` `validate()`; defaults include `NODE_ENV=development`, `PORT=3000`, `API_PREFIX=api/v1`.
- **Required (non-optional):** `JWT_AUTH_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `PROVIDER_ENCRYPTION_KEY`.
- Many optional groups: DB/Redis URL or parts, rate-limit, WhatsApp/Meta, VAPID, `INBOUND_EMAIL_SECRET`, logging, batch/HTTP/memory/cache tuning, etc.
- `EnvironmentValidationService.validateOrThrow()` is invoked during bootstrap (`main.ts:51-52`) and also provided in `AppModule` (`app.module.ts:163`).
- **Database config module:** `config/database.config.ts` registers `database` (prefers `DATABASE_URL`, falls back to host/port/user/pass/name; default name `notification_platform` in that config object).
- **Redis/queue config module:** `config/redis.config.ts` registers `redis` and `queue` (`queue.redis` connection prefers `REDIS_URL`, else host/port/password).
- **Logging config module:** `config/logging.config.ts` registers `logging` (level/format/file toggles, DB/perf flags, correlation header, Loki placeholders, thresholds).
- **Security-critical boot dependencies:** better-auth handler import/mount at `/api/auth` (`main.ts:19,64-65`), cookie/session/JWT/provider encryption keys expected by env validation and runtime modules.

### 2.3 `.env.example` vs runtime/code reality (notable mismatches)

- `.env.example` documents provider-routing/fallback vars (`SMS_*`, `EMAIL_PROVIDER`, etc.) and many provider credentials; actual wiring is distributed across modules/config and partially BYOP/tenant-scoped (not fully enumerated here) — treat as hints, not authoritative.
- Root `.env.example` default `PORT=3000` and db `notification_platform` differ from compose API wiring (`PORT=9000`, db `sanarwa_db`) and dev compose port mapping (`5441`).
- `METRICS_TOKEN` is enforced by metrics endpoint when set (`metrics.controller.ts`) but not present in either env example.
- `TRUST_PROXY` is read in bootstrap (`main.ts:54`) but not documented in env examples.

---

## 3. Application bootstrap, HTTP/runtime behavior

- **Entry:** `apps/api/src/main.ts`
- Nest app with `bufferLogs: true`, custom Nest log levels (production => error/warn), `bodyParser: false` initially; `enableShutdownHooks(["SIGINT","SIGTERM"])`; uses `nestjs-pino` `Logger`.
- `trust proxy` enabled only if `TRUST_PROXY === "true"`.
- Security middleware + CORS configured (`common/middleware/security.middleware.ts`).
- Mounts `betterAuthHandler` at `/api/auth` **before** `express.json` body parsing.
- JSON/urlencoded parsing with 1MB limits; captures `rawBody` for requests whose `originalUrl` includes `/billing/webhooks/` or `/webhooks/`.
- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- Global prefix `api/v1` with unversioned exclusions: `/` (GET), `/metrics` (GET), `/docs` (GET), `/mcp` (ALL) (`common/http/api-prefix.ts`).
- Swagger UI at `/docs` enabled only when `NODE_ENV !== "production"` (`createSwaggerConfig()` from `config/swagger.config`).
- Listens on `app.port` config or `3000`.
- **Root endpoint:** `GET /` (unversioned, public) returns `{ status: "ok", message, timestamp, version: "1.0.0" }` (`apps/api/src/app.controller.ts`).
- **Guards/interceptors (global):** `ThrottlerGuard`, `AuthGuard`, `MetricsInterceptor`, `AsyncLoggingInterceptor`, `AuditLogInterceptor`, `GlobalErrorInterceptor`, `ErrorAlertingInterceptor` (`app.module.ts:165-193`).
- **Middleware:** `CorrelationIdMiddleware` applied to `*path` (`app.module.ts:195-198`); request/performance logging components also provided by `LoggingModule`.

### Security middleware/CORS

- `configureSecurityMiddleware`: Helmet on most routes except paths starting `/api/v1/auth/reference`; CSP/HSTS/noSniff/xssFilter/referrerPolicy set; morgan logging in prod (`combined`) and non-prod (`dev`) streaming to Nest logger, **skipping `/metrics`**.
- `configureCORS`: allows configured origins or `*`, allows requests with no origin; in `development` it **allows any origin** even if not listed; credentials enabled; allowed headers include `Content-Type`, `Authorization`, `X-Requested-With`, `X-Tenant-ID`, `X-API-Key`.

---

## 4. Runtime dependencies, data, queues, and migrations

### 4.1 PostgreSQL

- **Connection:** TypeORM `DataSource` uses `process.env.DATABASE_URL`, `synchronize: false`, `SnakeNamingStrategy`, dev logging enabled by `NODE_ENV === "development"`, **`migrationsRun: true`, `migrationsTransactionMode: "all"`** (`apps/api/src/common/database/data-source.ts`).
- **Entities/migrations:** large explicit entity and migration registry in `data-source.ts` (users/tenants/auth/org/api keys/messaging/provider/billing/webhooks/whatsapp/workflows/topics/consent/delivery events/etc.).
- **Operational implication:** API startup will attempt to run pending migrations automatically against the configured database.

### 4.2 Redis

- **Global Redis client:** `@nestjs-modules/ioredis` single connection from `redis.url` (or config) with `maxRetriesPerRequest: 3` (`app.module.ts:83-96`, `config/redis.config.ts`).
- **BullMQ connection:** `BullModule.forRootAsync` uses `configService.get("queue.redis") ?? { host: "localhost", port: 6379 }` (`app.module.ts:76-81`).
- **Throttling storage:** dedicated `ioredis` instance from `redis.url` with `maxRetriesPerRequest: 3`, error handler noop, stored in `RedisThrottlerStorage`; global throttler defaults `ttl = RATE_LIMIT_WINDOW*1000`, `limit = DEFAULT_RATE_LIMIT` (env-validated defaults 60s/100), `skipIf` non-HTTP contexts (`app.module.ts:138-158`, `common/throttler/redis-throttler-storage.ts`).

### 4.3 Queues (BullMQ 6)

- **Registered queues observed in source:**
- `notification-queue` (core/admin ingest-like default opts: attempts 3, exponential backoff 2000ms, removeOnComplete 100/removeOnFail 50)
- `notification-delivery-queue` (attempts 5, exponential backoff 1000ms)
- `notification-admin-queue` (attempts 3, exponential backoff 2000ms)
- defined/exported in `modules/messaging/queue/notification-queue-core.module.ts` and constants in `modules/messaging/queue/notification-queue.constants.ts`.
- `webhook-retry-queue` in `modules/analytics/queue/webhook-queue.module.ts` (attempts 5, exponential backoff 2000ms) with `WebhookQueueService` and `WebhookRetryProcessor` exported/provided.
- **Runtime wiring:** queue modules/services/processors exist; a full end-to-end map of all producers/consumers across features was not exhaustively traced in this pass. Use these modules/constants as the navigation anchors.

### 4.4 Other notable runtime integrations (from code/config/docs)

- Better Auth mounted at `/api/auth` (`main.ts`, deps in `apps/api/package.json`).
- MCP endpoint excluded from API prefix (`/mcp`, `common/http/api-prefix.ts`), `MCP_RESOURCE`/`MCP_AUTHORIZATION_SERVER` in `apps/api/.env.example`, `SanarwaMcpModule` imported in `app.module.ts`.
- Inbound email/webhooks: raw body preserved for `/billing/webhooks/*` and `/webhooks/*`; inbound email ops documented separately (below).

---

## 5. CI workflows and quality gates

**Workflow:** `.github/workflows/ci.yml` (`CI`)

- Triggers: `push` and `pull_request` on `main`, `master`, `dev`.
- Permissions: `contents: read`.
- Global env: `PNPM_VERSION=10.25.0`, `NODE_VERSION=22`, `NODE_OPTIONS=--max-old-space-size=4096`.

| Job          | Runner/setup                                                     | Steps/gates                                                                                                                                               | Notes                                                                     |
| ------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `lint`       | ubuntu-latest, checkout, pnpm+node22 cache                       | `pnpm install --frozen-lockfile`, `pnpm lint`                                                                                                             | root script = `oxlint -c oxlint.json apps packages --quiet`               |
| `circular`   | same                                                             | install, `pnpm deps:circular`                                                                                                                             | **no such root script exists** (`package.json`)                           |
| `fallow`     | same, `fetch-depth: 0`                                           | install, `pnpm fallow audit --base... --gate new-only` (PR: `origin/${{github.base_ref}}`, push: `HEAD^`)                                                 | **no such root script exists**; comment states inherited backlog excluded |
| `type-check` | same                                                             | install, `pnpm type-check`                                                                                                                                | turbo recursive type-check                                                |
| `test`       | same                                                             | install, `pnpm test`                                                                                                                                      | turbo recursive (Vitest)                                                  |
| `build`      | same                                                             | install, `pnpm build`                                                                                                                                     | turbo recursive build                                                     |
| `containers` | checkout only                                                    | `docker build... apps/api/Dockerfile.`, `docker build... apps/web/Dockerfile.`                                                                            | validates image builds                                                    |
| `migrations` | postgres:16-alpine service (`sanarwa_ci`, healthchecked on 5432) | install, `migration:run`, `migration:revert`, `migration:run` with `DATABASE_URL=postgresql://sanarwa:sanarwa@localhost:5432/sanarwa_ci`, `NODE_ENV=test` | exercises up/down/up via `@sanarwa/api` TypeORM CLI datasource            |

**No jobs for:** deploy/publish, image push, environment promotion, SAST/dependency scanning, smoke/e2e against running stack, or alerting hooks.

**Baseline/gate reality (per `AGENTS.md`, repo-documented):** `build` green; `type-check` red in `@sanarwa/web` (43 errors, 12 files); `lint` red in web/packages (89 errors + 577 warnings), API clean; `test` red in API (16 failed files 75 failed tests of 725); `fmt:check` not measured. CI jobs `circular` and `fallow` are broken by missing scripts regardless of code health. Vite web build may pass without type-checking.

---

## 6. Observability, logging, metrics, alerting

### 6.1 Logging

- **Primary logger:** `nestjs-pino` (`LoggerModule.forRootAsync(loggerConfig)` in `common/logging/logging.module.ts`).
- `logger.config.ts`: level from `LOG_LEVEL` (default `info`); pretty transport in non-production, JSON-style structured output otherwise; correlation/user/tenant/request context via custom props and serializers; redacts auth/cookie/password/token/secret/apiKey; auto-logging skips `/metrics`.
- **HTTP access logging:** morgan `combined` (prod) `dev` (non-prod) in `security.middleware.ts`, skips `/metrics`, streamed to Nest logger.
- **App logging config surface:** `config/logging.config.ts` exposes file/DB/console/external(Loki)/performance knobs from env; actual sink enablement depends on module/service implementation (not all targets were traced to active outputs).
- **Correlation:** `CorrelationIdMiddleware` applied globally; logger generates/propagates `x-correlation-id` where available.

### 6.2 Metrics (Prometheus)

- **Endpoint:** `GET /metrics` (unversioned, `@Public`, `@SkipThrottle`, `text/plain`) in `common/monitoring/metrics.controller.ts`.
- If `METRICS_TOKEN` is unset: returns metrics in non-production; returns **404** in production.
- If set: requires `x-metrics-token` header to match, else **401**.
- **Registry/metrics:** `MetricsService` (`prom-client`) collects default Node/process metrics plus custom counters/histograms/gauges for HTTP, users/business events, DB, security/failed logins/rate-limit hits, and process memory/CPU (`setInterval` 10s). `GET /metrics` serves `register.metrics()`.
- **Collection:** `MetricsInterceptor` registered globally (`APP_INTERCEPTOR`); metrics module also exports providers. morgan/pino auto-logging skip `/metrics`.
- **No scrape config/manifests** (Prometheus, Grafana, dashboards, ServiceMonitor) found in repo.

### 6.3 Health checks

- **No dedicated Nest `@nestjs/terminus` health controller/route found** despite `TerminusModule`/`@nestjs/terminus` dependency and `MonitoringModule` importing `TerminusModule` and `HttpModule`.
- **Liveness-ish signal:** unversioned `GET /` returns status payload (`app.controller.ts`).
- **Container health:** only web image defines a Docker `HEALTHCHECK` (HTTP GET `/` on port 3000). API image and compose services (except DB/Redis dependency healthchecks) do not define app-level healthchecks.
- Some modules/tests reference "health" concepts (provider/config/cache health checks, logging health indicator in tests) — these are internal/domain checks, not standardized operational HTTP health endpoints.

### 6.4 Alerting tracing SLOs

- **No in-repo alerting rules, paging integrations, OpenTelemetry tracing, Sentry/Datadog exporters, or SLO runbooks found.** `ErrorAlertingInterceptor` is globally registered (`app.module.ts`), but external alert destinations/configuration were not evidenced in the reviewed infra/docs files.

---

## 7. Operational runbooks and docs

| Document                           | Location                                                                               | Coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inbound email production readiness | `docs/INBOUND-EMAIL-PRODUCTION.md`                                                     | Prereqs (migrations/build, `INBOUND_EMAIL_SECRET`), endpoint contract for `POST /api/v1/notifications/inbound` (HMAC-SHA256 of `${tenantId}:${messageId}:${threadId}:${epochMs}`, 24h validity + 5m skew, dedupe by `messageId`), request/response semantics (`200 received/suppressed`, `400/401/503/429`), signing helper (`apps/api/scripts/sign-inbound-email.mjs`), curl example, provider/relay wiring/idempotency/retry guidance, operational notes (secret rotation, clock accuracy, WAF allowlisting, separate `GET /api/v1/notifications/ingest` API-key path), code references |
| Product/architecture overview      | `README.md`                                                                            | High-level architecture, features, example send request, tech stack; limited ops/deploy detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Agent/repo operating instructions  | `AGENTS.md`                                                                            | Commands, gate baseline, known-stale docs, local infra caveats (e.g. untracked `docker-compose.dev.yml`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Other docs                         | `docs/EXTENSIBILITY-CAMPAIGNS-WORKFLOWS.md`, `docs/index.mdx`, auth/api-reference docs | Present but not operational deployment runbooks; not analyzed in depth for this ticket                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**No generic production deploy, rollback, backup/restore, incident response, on-call, or capacity runbook found.**

---

## 8. Concrete issues scoped fixes & migration candidates (to navigate/change infra safely)

> These are repo-grounded observations/candidates. They are **not** applied.

1. **CI references missing scripts (hard CI break risk):** `.github/workflows/ci.yml` runs `pnpm deps:circular` and `pnpm fallow audit...`, but `package.json` defines neither. _Scoped fix:_ add scripts (or replace/remove jobs) to match actual tooling/policy.
2. **Automatic migrations on app boot:** `apps/api/src/common/database/data-source.ts` sets `migrationsRun: true` with `migrationsTransactionMode: "all"`. In multi-instance deploys/restarts this can cause startup contention or unexpected schema changes at process boot. _Scoped change/migration:_ move migrations to an explicit deploy/CI/init step and disable autorun in runtime services (keep CI `migrations` job as the controlled path).
3. **No app-level health/readiness endpoint:** root `GET /` is informational only; Terminus is imported but no `/health` route/controller observed. Compose/API image lack app healthchecks and web depends on API `service_started`. _Scoped fix:_ add liveness/readiness endpoints (DB/Redis/BullMQ checks as appropriate), wire Docker/compose/orchestrator probes, and gate dependencies on readiness.
4. **Metrics exposure semantics:** `/metrics` is public when `METRICS_TOKEN` is unset in non-prod but intentionally hidden as 404 in prod without token (`metrics.controller.ts`). `METRICS_TOKEN` is undocumented in env examples. _Scoped fix:_ document token/network controls, add to env templates/secrets management, and ensure scrape path/auth fits target environment.
5. **CORS behavior overrides intent in development:** `security.middleware.ts` allows any origin when `NODE_ENV === "development"`, regardless of `CORS_ORIGIN`. This can mask misconfiguration before staging/prod. _Scoped fix:_ make dev behavior explicit/configurable and log effective policy.
6. **Environment/config drift and ambiguity:** multiple env templates with conflicting defaults/names (`.env.example` vs `apps/api/.env.example` vs compose values), `database.config.ts` default DB name differs from compose, and some runtime toggles (`TRUST_PROXY`, `METRICS_TOKEN`) are undocumented. _Scoped fix:_ consolidate to a single authoritative env contract per deploy target and validate at startup/CI.
7. **Compose `web -> api` dependency is weak:** `depends_on: api: condition: service_started` means web can start before API is ready; API has no healthcheck. _Scoped fix:_ add API healthcheck + `service_healthy` dependency.
8. **`docker-compose.yml` runs API as `NODE_ENV=development`:** may enable dev-only behavior (Swagger, permissive CORS path, logging/pretty output differences) in a “deployed local stack” context. _Scoped fix:_ parameterize env/mode per intended use.
9. **Web image bakes `VITE_API_URL` at build time with a different default than compose arg:** Dockerfile default `http://localhost:9000/api/v1` vs compose arg/runtime `http://localhost:9010/api/v1`; Vite-style vars are typically compile-time. _Scoped fix:_ align build args/runtime strategy and document rebuild requirements when API origin changes.
10. **Supply-chain/install posture in images:** Dockerfiles copy full source and `node_modules` into stages/final images in places; no separate production-only dependency pruning shown. _Scoped improvement:_ prune dev deps/artifacts and reduce image surface (validate against Nest/TS build needs).
11. **Documented vs actual local infra bootstrap:** `AGENTS.md` states `docker-compose.dev.yml` is untracked while scripts/commands reference it; onboarding path differs for fresh clones. _Scoped fix:_ track dev compose or remove/adjust scripts/docs to one canonical path.
12. **Observability gaps for operations:** no tracing, dashboards, alert rules, or centralized log shipping config evidenced; `/metrics` protection is token-or-env based only. _Scoped roadmap:_ define scrape/auth, log aggregation, and alert ownership alongside health probes.

---

## 9. Safe navigation/change checklist (practical)

- **Change deploy topology/ports/env:** update `docker-compose*.yml`, corresponding Dockerfiles/build args, and env examples/docs together; verify `VITE_API_URL` build-time behavior for web.
- **Change DB schema:** add TypeORM migration under `apps/api/src/common/database/migrations`, register in `data-source.ts`, and validate with `pnpm --filter @sanarwa/api migration:run|revert|run` (CI `migrations` job mirrors this pattern).
- **Change API routing/ops endpoints:** respect `API_PREFIX` and `UNVERSIONED_PATHS` (`common/http/api-prefix.ts`); keep `/metrics`, `/mcp`, webhooks, and better-auth mount behavior in mind.
- **Change queues/workers:** start from `modules/messaging/queue/*` and `modules/analytics/queue/*` (names, retry/backoff defaults) and trace producers/processors before altering semantics.
- **Change observability:** coordinate `monitoring.module.ts`, `metrics.controller.ts`, logger config/middleware, and any scrape/auth assumptions; avoid logging secrets (redaction already configured in pino serializers).
- **Before claiming readiness:** run/check `pnpm fmt:check && pnpm lint:all && pnpm test && pnpm type-check && pnpm build` and account for known baseline failures per `AGENTS.md` CI script gaps.
