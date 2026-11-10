# [001] Repo topology and build/release model

- **Label:** `wayfinder:research`
- **Status:** closed (resolved)
- **Parent map:** [Whole-repo understanding map](../MAP-001-whole-repo-understanding.md)
- **Blocked by:** none
- **Blocks:** none (informs fog graduation)

## Question

What is the accurate topology and build/release model of the whole Sanarwa repo — workspaces (`apps/*`, `packages/*`), package manager/tooling (pnpm, Turbo, tsconfig), scripts/gates (build, test, lint, fmt, type-check), CI workflows, Docker/compose and local infra, and how artifacts/environments fit together — stated clearly enough that a new contributor knows how the repo is structured and operated?

## Resolution

# Sanarwa Monorepo — Repo Topology and Build/Release Model (Ticket 001)

_Grounded in repository files read on 2026-11-10 from `/home/daniel/Documents/projects/sanarwa`._

## 1. Workspace topology

### 1.1 Workspace and package manager

- **Workspace definition:** `pnpm-workspace.yaml`
- `packages: ['apps/*', 'packages/*']`
- **Package manager:** root `package.json` → `"packageManager": "pnpm@10.25.0"`
- **Repo metadata:** root `package.json` → `name: "sanarwa"`, `version: "0.1.0"`, `private: true`

### 1.2 Applications (`apps/*`)

| Workspace | Path       | `package.json` name                                   | Purpose stack (from manifests & docs)                                                                                                                                                                                                         | Entry/build artifact                                                                                                                                                                                                         |
| --------- | ---------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API       | `apps/api` | `@sanarwa/api` (`0.0.1`, private)                     | NestJS 11 REST API, TypeORM/Postgres, BullMQ/Redis, Swagger, Passport/JWT, Better Auth deps present, MCP/server deps present (`README.md`, `ARCHITECTURE.md`, `apps/api/package.json`)                                                        | Build: `nest build` → `dist/` (`tsconfig.json` `outDir:./dist`, `module: commonjs`). Prod start: `node dist/main` (`start:prod`). Docker runtime copies `dist`, `package.json`, `node_modules` and runs `node dist/main.js`. |
| Web       | `apps/web` | `@sanarwa/web` (`0.1.0`, private, `"type": "module"`) | TanStack Start + React 19 + Vite 7 + Nitro, React Query/Redux, Tailwind 4, Radix/UI deps, consumes `@sanarwa/api-client`, `@sanarwa/ui`, `@sanarwa/assets`, `@sanarwa/shared-types` (`apps/web/package.json`, `README.md`, `ARCHITECTURE.md`) | Build: `vite build` → `.output/` (Turbo outputs include `.output/**`). Start: `node.output/server/index.mjs`. Docker runtime copies `.output` and runs `node.output/server/index.mjs`.                                       |

### 1.3 Packages (`packages/*`)

| Workspace    | Path                    | `package.json` name                                  | Role                                                                                                                                                              | Source/export model                                                                                                                    | Build/test behavior (declared)                                                                    |
| ------------ | ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| API client   | `packages/api-client`   | `@sanarwa/api-client` (`0.1.0`, private, ESM)        | HTTP client for API, shared by web/SDK (`ARCHITECTURE.md`)                                                                                                        | Exports `./src/index.ts` (source)                                                                                                      | `build`/`type-check`: `tsc --noEmit`; `lint`/`test`: echo placeholders                            |
| SDK          | `packages/sdk`          | `@sanarwa/sdk` (`0.2.0`, MIT, public-style manifest) | Public TS/JS SDK for Sanarwa API                                                                                                                                  | Built distribution: `main` CJS `dist/index.cjs`, `module` ESM `dist/index.js`, `types`/exports to `dist/*`; `files: [dist, README.md]` | `build`: `rollup -c`; `dev`: watch; `test`: `vitest run`; `type-check`: `tsc --noEmit`            |
| UI           | `packages/ui`           | `@sanarwa/ui` (`0.1.0`, private, ESM)                | React component library used by web (`ARCHITECTURE.md`)                                                                                                           | Source exports (`.`, `./utils`, styles, `./*` → `src/*.tsx`)                                                                           | `build`/`type-check`: `tsc --noEmit`; `lint`/`test`: placeholders; peers `react@^19`              |
| Assets       | `packages/assets`       | `@sanarwa/assets` (`0.1.0`, private, ESM)            | Brand logos/marks/icons/favicons (`ARCHITECTURE.md`)                                                                                                              | Source exports for `logos/icons/favicon` and index                                                                                     | `build`/`type-check`: `tsc --noEmit`; placeholders for lint/test                                  |
| Config       | `packages/config`       | `@sanarwa/config` (`0.1.0`, private)                 | Shared tsconfig presets only (`ARCHITECTURE.md`)                                                                                                                  | Exports `./tsconfig/base                                                                                                               | react                                                                                             | node` JSON presets | `build/lint/test/type-check`: echo/no-op scripts |
| MCP          | `packages/mcp`          | `@sanarwa/mcp` (`0.1.0`, MIT)                        | MCP server exposing Sanarwa notification API to AI agents                                                                                                         | Built to `dist` (`main/types`, `bin: sanarwa-mcp -> dist/index.js`)                                                                    | `build`: `tsc -p tsconfig.json`; `dev`: watch; `test`: `vitest run`; `type-check`: `tsc --noEmit` |
| Shared types | `packages/shared-types` | `@sanarwa/shared-types` (`0.1.0`, private, ESM)      | Cross-package types; `ARCHITECTURE.md` notes **currently has zero importers** (manifest shows it is depended on by `apps/api`, `apps/web`, `packages/api-client`) | Source export `./src/index.ts`                                                                                                         | `build`/`type-check`: `tsc --noEmit`; placeholders for lint/test                                  |

### 1.4 Internal dependency graph (declared in manifests)

- `apps/api` → `@sanarwa/sdk` (`workspace:*`), `@sanarwa/shared-types` (`workspace:*`)
- `apps/web` → `@sanarwa/api-client`, `@sanarwa/assets`, `@sanarwa/shared-types`, `@sanarwa/ui` (`workspace:*`)
- `packages/api-client` → `@sanarwa/shared-types` (`workspace:*`), `axios`
- `packages/mcp` → `@sanarwa/sdk` (`workspace:*`), `@modelcontextprotocol/sdk`, `zod`
- `packages/sdk` → runtime `axios`, `tslib` (no workspace deps declared)
- `packages/ui`, `packages/assets` → React peer deps; no workspace runtime deps declared

> Note: `apps/web/tsconfig.json` also contains a path alias for `@sanarwa/core` → `../../packages/core/src/index.ts`, but no `packages/core` workspace or manifest was present in the files read.

## 2. Tooling and configuration

### 2.1 Task orchestration — Turbo (`turbo.json`)

- Schema: `https://turborepo.dev/schema.v2.json`
- Tasks:
- `build`: `dependsOn: ["^build"]`, `outputs: ["dist/**", ".output/**"]`
- `dev`: `cache: false`, `persistent: true`
- `test`: `{}` (no explicit dependency/output config)
- `type-check`: `{}` (no explicit dependency/output config)
- No `lint` or `fmt` tasks are defined in Turbo; lint/format are driven by root scripts/tools directly.

### 2.2 TypeScript configuration

- **Root baseline:** `tsconfig.base.json`
- `target: ES2022`, `lib: [dom, dom.iterable, ES2022]`, `module: ESNext`, `moduleResolution: bundler`
- `strict: true`, `skipLibCheck: true`, `esModuleInterop`, `resolveJsonModule`, `isolatedModules`
- `declaration`/`declarationMap: true`
- Strictness flags: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- **Shared presets (`packages/config`)** export:
- `tsconfig.base.json` (mirrors root-style strict/bundler base)
- `tsconfig.react.json` (extends `../../tsconfig.base.json`, `jsx: react-jsx`, `noEmit`)
- `tsconfig.node.json` (extends base, `CommonJS`/`node` resolution, `outDir: dist`, `noEmit: false`)
- **API (`apps/api`)**
- `tsconfig.json`: Nest-oriented CommonJS build (`module: commonjs`, `target: ES2022`, `emitDecoratorMetadata`, `experimentalDecorators`, `outDir:./dist`, `incremental`, `strictNullChecks: true`, several strict flags relaxed). Includes `src/**/*`; excludes tests/build artifacts.
- `tsconfig.build.json`: extends API tsconfig, excludes tests/node_modules/dist/coverage.
- **Web (`apps/web/tsconfig.json`)**
- Bundler/ESM, `jsx: react-jsx`, `strict: true`, `noEmit: true`, Vite/Vitest types, path aliases for `@/*` and in-repo package sources (`@sanarwa/api-client`, `@sanarwa/ui`, `@sanarwa/ui/*`, `@sanarwa/core`).
- Excludes `src/app`, tests/specs, and test dirs from type-check scope.
- **Packages**
- `sdk`: extends root base, emits declarations/maps to `dist` (with `noEmit` used for type-check script), Vitest types.
- `mcp`: extends root base, `module/moduleResolution: NodeNext`, emits declarations to `dist`, node+vitest types.
- `api-client`, `ui`, `assets`, `shared-types`: extend root base, `noEmit` (source-consumed packages).
- **TypeScript versioning (declared):** root devDependency `^7.0.2`; app/package devDependencies vary (e.g. API `^5.9.3`, web `^5`, SDK/MCP `^5.x`, config package has no TS dep).

### 2.3 Linting and formatting — Oxlint/Oxfmt (`oxlint.json`, root scripts)

- Root devDependencies: `oxlint ^1.90.0`, `oxfmt ^0.75.0`.
- `oxlint.json`:
- Schema: `./node_modules/oxlint/configuration_schema.json`
- Plugins: `typescript`, `import`, `react`, `unicorn`
- Categories: `correctness = error`, `suspicious = warn`
- Notable rule overrides: `react/react-in-jsx-scope` off; several correctness/style/react-hooks/unicorn rules set to warn/off.
- Ignore patterns include build/output dirs, `routeTree.gen.ts`, `**/*.spec.ts`, `**/*.e2e-spec.ts`, `**/test/**`, `**/examples/**`, `**/scripts/**`.
- Root scripts:
- `lint`: `oxlint -c oxlint.json apps packages --quiet`
- `lint:all`: `oxlint -c oxlint.json apps packages`
- `lint:fix`: `oxlint... --fix && oxfmt.` (formats/writes)
- `fmt`: `oxfmt.` (write)
- `fmt:check`: `oxfmt --check.`
- Per-workspace lint scripts are inconsistent: API and web lint `src` with `../../oxlint.json`; SDK/MCP lint `src`; several packages use `echo 'lint skipped'`.

### 2.4 Testing — Vitest (Turbo + per-workspace configs)

- Turbo runs `test` across workspaces (`pnpm test` → `turbo run test`).
- **API (`apps/api/vitest.config.ts`, `package.json`)**
- `unplugin-swc` for decorators/metadata; `environment: node`; `globals: true`; setup `./test/vitest.setup.ts`
- Includes `src/**/*.spec.ts`; excludes e2e/http/integration/`*.vitest.spec.ts` patterns
- Test env sets `NODE_ENV=test`, `DATABASE_URL=sqlite::memory:` in Vitest config
- Scripts: `test`/`test:watch`/`test:cov` via Vitest; `test:e2e`: `vitest test/auth.vitest.e2e.spec.ts --run`
- **Web (`apps/web/vitest.config.ts`)**
- `jsdom`, React plugin, setup `./src/test/setup.ts`, `globals`, CSS enabled
- **Narrow include list** (only 4 specific test files under `src/lib/**` and `src/components/monitoring/**`); coverage configured (v8) with standard excludes
- Scripts include `test` and `test:run` (`vitest run`), `clean`
- **SDK/MCP**: `vitest run` scripts; Vitest configs exist in `packages/sdk/vitest.config.ts`, `packages/mcp/vitest.config.ts` (not exhaustively detailed here beyond presence/scripts).
- **Other packages**: `test` scripts are placeholders (`echo 'no tests'`).

## 3. Scripts and quality gates

### 3.1 Root scripts (`package.json`)

| Script         | Command                                                     | Purpose                                    |
| -------------- | ----------------------------------------------------------- | ------------------------------------------ |
| `dev`          | `turbo run dev --filter=@sanarwa/web --filter=@sanarwa/api` | Run web + API dev tasks only               |
| `build`        | `turbo run build`                                           | Build all workspaces (respecting `^build`) |
| `test`         | `turbo run test`                                            | Run tests across workspaces                |
| `lint`         | `oxlint -c oxlint.json apps packages --quiet`               | Quiet lint gate                            |
| `lint:all`     | `oxlint -c oxlint.json apps packages`                       | Full lint output                           |
| `lint:fix`     | `oxlint... --fix && oxfmt.`                                 | Auto-fix lint + format write               |
| `fmt`          | `oxfmt.`                                                    | Format (write)                             |
| `fmt:check`    | `oxfmt --check.`                                            | Format check                               |
| `type-check`   | `turbo run type-check`                                      | Type-check across workspaces               |
| `deploy:local` | `docker compose up --build`                                 | Full local stack via root compose          |
| `infra:up`     | `docker compose -f docker-compose.dev.yml up -d`            | Dev infra only (postgres/redis)            |
| `infra:down`   | `docker compose -f docker-compose.dev.yml down`             | Stop dev infra                             |

### 3.2 API-specific operational scripts (`apps/api/package.json`)

- Runtime/build: `build` (`nest build`), `start`, `dev` (`nest start --watch`), `start:debug`, `start:prod`
- Quality: `lint`, `lint:fix`, `format`/`format:check` (oxfmt), `type-check` (`tsc --noEmit`)
- Tests: `test`, `test:watch`, `test:cov`, `test:e2e` (single e2e spec path)
- TypeORM CLI/migrations: `typeorm`, `migration:generate`, `migration:run`, `migration:revert`, `migration:create` (all via `typeorm-ts-node-commonjs` with datasource `src/database/data-source.ts`)

### 3.3 Documented/referenced gates vs repo reality (important for operators)

- `AGENTS.md` and `ARCHITECTURE.md` describe gates/scripts including `fmt:fix`, `pnpm fallow`, and CI behavior; **actual root scripts do not include** `fmt:fix` (root has `fmt`/`fmt:check`) or `fallow`/`deps:circular`.
- `.github/workflows/ci.yml` invokes `pnpm lint`, `pnpm deps:circular`, `pnpm fallow audit...`, `pnpm type-check`, `pnpm test`, `pnpm build` (see §4). The presence of `circular` and `fallow` jobs/scripts in CI but absence of corresponding root scripts is a structural mismatch grounded in the files read.
- `AGENTS.md` states a baseline where build/type-check/lint/test/fmt may be red/unknown on `dev`; this report documents **declared** commands/config, not a fresh gate execution result.

## 4. CI workflows (`.github/workflows/ci.yml`)

- **Triggers:** `push` and `pull_request` on branches `[main, master, dev]`
- **Permissions:** `contents: read`
- **Global env:** `PNPM_VERSION=10.25.0`, `NODE_VERSION=22`, `NODE_OPTIONS=--max-old-space-size=4096`
- **Common setup pattern (most jobs):** checkout → `pnpm/action-setup@v4` (pinned version) → `actions/setup-node@v4` (Node 22, pnpm cache) → `pnpm install --frozen-lockfile`

| Job          | Runner/services                    | Key steps                                                                                                                              | Notes                                                                                                                                      |
| ------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `lint`       | `ubuntu-latest`                    | `pnpm lint`                                                                                                                            | Root quiet oxlint over `apps packages`                                                                                                     |
| `circular`   | `ubuntu-latest`                    | `pnpm deps:circular`                                                                                                                   | Script not present in root `package.json` (from files read)                                                                                |
| `fallow`     | `ubuntu-latest`, `fetch-depth: 0`  | `pnpm fallow audit --base... --gate new-only`                                                                                          | PR: base `origin/${{ github.base_ref }}`; push: `HEAD^`. Script not present in root `package.json`                                         |
| `type-check` | `ubuntu-latest`                    | `pnpm type-check`                                                                                                                      | Turbo recursive type-check                                                                                                                 |
| `test`       | `ubuntu-latest`                    | `pnpm test`                                                                                                                            | Turbo recursive tests                                                                                                                      |
| `build`      | `ubuntu-latest`                    | `pnpm build`                                                                                                                           | Turbo recursive build                                                                                                                      |
| `containers` | `ubuntu-latest`                    | `docker build` for API and Web images tagged with `${{ github.sha }}` using `apps/api/Dockerfile`, `apps/web/Dockerfile` (context `.`) | Image build validation/publish-less CI step (no push shown)                                                                                |
| `migrations` | `ubuntu-latest` + Postgres service | Runs `migration:run`, `migration:revert`, `migration:run` in `@sanarwa/api`                                                            | Service: `postgres:16-alpine`, db `sanarwa_ci`; env `DATABASE_URL=postgresql://sanarwa:sanarwa@localhost:5432/sanarwa_ci`, `NODE_ENV=test` |

## 5. Docker, Compose, and local infrastructure

### 5.1 Docker images

**`apps/api/Dockerfile` (multi-stage, Node 22 Alpine + pnpm 10.25.0)**

1. `base`: enable corepack, activate `pnpm@10.25.0`, `WORKDIR /app`
2. `deps`: copy repo, `pnpm install --frozen-lockfile --filter @sanarwa/api...`
3. `builder`: copy deps + source; build `@sanarwa/sdk` then `@sanarwa/api`
4. `runner`: `NODE_ENV=production`; copies `apps/api/dist`, `apps/api/package.json`, and **root** `node_modules`; `EXPOSE 9000`; `USER node`; `CMD ["node", "dist/main.js"]`

**`apps/web/Dockerfile` (multi-stage, Node 22 Alpine + pnpm 10.25.0)**

1. `base/deps`: `pnpm install --frozen-lockfile --filter @sanarwa/web...`
2. `builder`: build arg/env `VITE_API_URL` default `http://localhost:9000/api/v1`; builds from `apps/web` (`pnpm build` → `.output`)
3. `runner`: `NODE_ENV=production`; copies `apps/web/.output`; `EXPOSE 3000`; `USER node`; HTTP healthcheck on `http://127.0.0.1:3000/`; `CMD ["node", ".output/server/index.mjs"]`

### 5.2 Full-stack local deployment — `docker-compose.yml`

- **Services:**
- `postgres`: `postgres:16-alpine`, creds/db `sanarwa/sanarwa/sanarwa_db`, host `5432:5432`, volume `postgres_data`, healthcheck `pg_isready`
- `redis`: `redis:7-alpine`, host `6379:6379`, volume `redis_data`, healthcheck `redis-cli ping`
- `api`: builds `apps/api/Dockerfile`; host `9010 -> container 9000`; depends on healthy postgres/redis; sets `NODE_ENV=development`, `PORT=9000`, internal DB/Redis URLs, JWT/session/provider secrets, CORS/frontend/trusted origins for `localhost:3000/3001`; restart unless-stopped
- `web`: builds `apps/web/Dockerfile` with `VITE_API_URL=http://localhost:9010/api/v1`; host `3000:3000`; runtime env also sets `VITE_API_URL`; depends on `api` (started); restart unless-stopped
- **Network model:** containers use service DNS (`postgres`, `redis`); browser-facing API URL is exposed on host port `9010`.
- **Entry point:** root `pnpm deploy:local` → `docker compose up --build`.

### 5.3 Dev-only infrastructure — `docker-compose.dev.yml`

- Purpose (per file header): local Postgres/Redis only, with **non-default host ports** to avoid collisions on this machine.
- **Services:**
- `postgres`: `postgres:16-alpine`, host `5441:5432`, volume `sanarwa_postgres_data`, db/user/pass `sanarwa/sanarwa/sanarwa_db`, healthcheck, restart unless-stopped
- `redis`: `redis:7-alpine`, host `6391:6379`, volume `sanarwa_redis_data`, healthcheck, restart unless-stopped
- **Images:** header states pinned to versions already present in local cache (to avoid pulls).
- **Usage:** root `pnpm infra:up` `pnpm infra:down`; header suggests running API migrations against it after startup.
- **Operator note:** `AGENTS.md` states this file is untracked in the checkout and recommends `docker compose up postgres redis` from root `docker-compose.yml` for fresh clones; however, `docker-compose.dev.yml` **is present** in the filesystem read for this workspace.

## 6. Artifacts, environments, and how pieces fit together

### 6.1 Build artifacts and runtime outputs

- **Turbo-declared outputs:** `dist/**`, `.output/**` (covers API/Nest `dist`, web TanStack/Nitro `.output`, and package dist outputs such as SDK/MCP where produced).
- **API:** compiled Node/CommonJS app in `apps/api/dist` (entry `dist/main` `dist/main.js`).
- **Web:** Vite SSR/server bundle in `apps/web/.output` with server entry `.output/server/index.mjs`.
- **SDK (`@sanarwa/sdk`):** publishable/bundled artifacts in `dist` (ESM, CJS, d.ts) via Rollup.
- **MCP (`@sanarwa/mcp`):** compiled CLI/server artifacts in `dist` (bin `sanarwa-mcp`).
- **Source-exported internal packages:** `api-client`, `ui`, `assets`, `shared-types`, `config` primarily export TypeScript/source or config files; their `build` scripts mostly perform type-check/no-op rather than emitting runtime bundles.

### 6.2 Environment/config flow (as evidenced)

- **API runtime config (compose/README):** `NODE_ENV`, `PORT`, `DATABASE_URL`, `REDIS_URL`, JWT/session secrets, provider encryption key, CORS/frontend/trusted origins; additional provider/payment/auth env vars referenced in docs/manifests (e.g. Bachs/payment, OAuth/provider credentials, Better Auth-related deps/keys discussed in docs).
- **Web runtime/build config:** `VITE_API_URL` passed as Docker build arg and environment; web Dockerfile bakes default API URL for build and also sets env in runner.
- **Port mapping in full compose:** web `3000:3000`, API `9010:9000`, Postgres `5432:5432`, Redis `6379:6379`.
- **Dev infra compose:** Postgres `5441:5432`, Redis `6391:6379` (local-collision avoidance).
- **API routes/ops model (from docs):** versioned under `/api/v1`; `/health` and `/metrics` excluded from prefix (`ARCHITECTURE.md`, `README.md`).

### 6.3 Data and migration flow

- **ORM/datasource:** TypeORM with PostgreSQL; entities in module-local `*/entities/*.entity.ts`; migrations in `apps/api/src/database/migrations/` run via `typeorm-ts-node-commonjs -d src/database/data-source.ts` (`ARCHITECTURE.md`, `apps/api/package.json`).
- **Async/queue/metrics:** BullMQ/Redis and Nest Bull integration; logging/metrics libs present in API deps (`ARCHITECTURE.md`, `apps/api/package.json`).
- **CI migration gate:** dedicated `migrations` job provisions Postgres 16, installs deps, and executes `migration:run → migration:revert → migration:run` to validate forward/backward/forward application.

### 6.4 End-to-end operational model (repo as configured)

1. **Install:** `pnpm install` (lockfile-based, CI uses `--frozen-lockfile`; pnpm 10.25.0).
2. **Local infra options:** run `docker-compose.yml` services `postgres`/`redis` (standard ports) or `docker-compose.dev.yml` (offset ports) for DB/cache; provide matching API env (notably `DATABASE_URL`, `REDIS_URL`).
3. **Schema readiness:** run `pnpm --filter @sanarwa/api migration:run` (or via API workspace scripts).
4. **Development:** `pnpm dev` runs Turbo dev for `@sanarwa/web` and `@sanarwa/api` (persistent, uncached tasks).
5. **Validation/build pipeline (declared):** lint/format checks (`oxlint`/`oxfmt`), `turbo run type-check`, `turbo run test`, `turbo run build` (dependency-aware), plus CI-only container builds and migration round-trip; some CI jobs reference scripts not defined in root manifests.
6. **Local full-stack container run:** `pnpm deploy:local` builds and starts postgres, redis, API, and web with compose-defined wiring (web targets API at host-exposed `http://localhost:9010/api/v1`).
7. **Release artifacts (implied by configs):** container images for API/web (Dockerfiles + CI container job), compiled server bundles (`dist`, `.output`), and package distributions for `@sanarwa/sdk` and `@sanarwa/mcp`.

## 7. Notable documentation/config drift observed (from read files)

- `ARCHITECTURE.md` tooling table lists `pnpm fmt:fix` and `pnpm fallow`, and states CI runs lint/tests/fallow audit; root scripts/CI job commands do not fully align (no `fmt:fix`, no root `fallow`/`deps:circular`, but CI calls `deps:circular` and `fallow`).
- `ARCHITECTURE.md` says “There is no Better Auth…” while `apps/api/src/main.ts` usage is not re-audited here beyond manifests/docs, but API dependencies include `better-auth` and `@hedystia/better-auth-typeorm` (and web depends on `better-auth`).
- `ARCHITECTURE.md` “Known state” about build/type-check failures in `apps/api/src/modules/template/**` conflicts with `AGENTS.md` baseline claiming `apps/api` type-checks clean and web has type-check/lint/test issues; this report does not adjudicate runtime status beyond recorded configuration.
- `README.md` examples/defaults (e.g. API on `3000`, frontend `3001`) differ from compose defaults in this repo (`web` on `3000`, `api` container on `9000` exposed as host `9010`).

**Primary sources consulted:** `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `oxlint.json`, `.github/workflows/ci.yml`, `docker-compose.yml`, `docker-compose.dev.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/api/package.json`, `apps/web/package.json`, all `packages/*/package.json`, app/package tsconfig files (`apps/api/tsconfig*.json`, `apps/web/tsconfig.json`, `packages/*/tsconfig.json`, `packages/config/tsconfig*.json`), `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts`, `README.md`, `ARCHITECTURE.md`.
