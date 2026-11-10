# [004] Packages and cross-workspace contracts

- **Label:** `wayfinder:research`
- **Status:** closed (resolved)
- **Parent map:** [Whole-repo understanding map](../MAP-001-whole-repo-understanding.md)
- **Blocked by:** none
- **Blocks:** none (informs fog graduation)

## Question

What do the workspace packages (`packages/api-client`, `packages/sdk`, `packages/ui`, `packages/assets`, `packages/config`, `packages/shared-types`, `packages/mcp`) each own, how are they built/consumed, and what contracts/surfaces do they expose between `apps/api`, `apps/web`, and external consumers — stated clearly enough to explain cross-workspace boundaries and dependencies?

## Resolution

# [004] Packages and cross-workspace contracts — Sanarwa

Research scope: `packages/api-client`, `packages/sdk`, `packages/ui`, `packages/assets`, `packages/config`, `packages/shared-types`, `packages/mcp` in `/home/daniel/Documents/projects/sanarwa`.  
Grounded in package manifests/READMEs/entrypoints/tsconfigs and app references in `apps/web` and `apps/api` (quick-to-medium thoroughness).

## Workspace context

- Root package: `package.json` (`name: "sanarwa"`, `private: true`, `packageManager: pnpm@10.25.0`, turbo scripts: `dev|build|test|lint|type-check`).
- Workspaces: `pnpm-workspace.yaml` → `apps/*`, `packages/*`.
- App manifests show actual cross-workspace deps:
  - `apps/web/package.json`: depends on `@sanarwa/api-client`, `@sanarwa/assets`, `@sanarwa/shared-types`, `@sanarwa/ui` (`workspace:*`).
  - `apps/api/package.json`: depends on `@sanarwa/sdk`, `@sanarwa/shared-types` (`workspace:*`).

## Dependency/contract map (high level)

| Package                 | Kind                                       | Depends on (workspace)                             | Primary consumers                                                                            |
| ----------------------- | ------------------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `@sanarwa/shared-types` | shared type contracts                      | —                                                  | `@sanarwa/api-client`, `apps/api`, `apps/web`                                                |
| `@sanarwa/config`       | tsconfig presets                           | —                                                  | other packages extend `../../tsconfig.base.json` (local) and/or may consume exported presets |
| `@sanarwa/ui`           | React UI primitives/design system          | — (peer: `react`, `react-dom`)                     | `apps/web`                                                                                   |
| `@sanarwa/assets`       | brand/logo assets                          | — (peer: `react`, `react-dom`)                     | `apps/web`                                                                                   |
| `@sanarwa/api-client`   | web/app HTTP client (tenant/session-aware) | `@sanarwa/shared-types`, `axios`                   | `apps/web`                                                                                   |
| `@sanarwa/sdk`          | external/public TS SDK for Sanarwa API     | `axios`, `tslib`                                   | `@sanarwa/mcp`, `apps/api` (declared), external consumers                                    |
| `@sanarwa/mcp`          | MCP server wrapping SDK tools              | `@sanarwa/sdk`, `@modelcontextprotocol/sdk`, `zod` | AI agents / MCP hosts (stdio or HTTP), external consumers                                    |

```text
shared-types ──▶ api-client ──▶ web
      │
      └────────▶ api (declared dep)

sdk ──▶ mcp (agent/external)
 │
 └──▶ api (declared dep)

ui, assets ──▶ web
config (presets) ──▶ package/app tsconfig composition (intended)
```

---

## 1) `packages/api-client` (`@sanarwa/api-client`)

**Ownership / purpose**

- Internal, app-facing HTTP client for Sanarwa (web-oriented). Implements Axios-based requests, auth token storage/refresh, tenant scoping, path resolution, retries, and feature-specific API modules.
- Source layout: `packages/api-client/src/*` modules (`client.ts`, `auth.ts`, `config.ts`, `env.ts`, `error-handler.ts`, `api-key.ts`, `project.ts`, `provider.ts`, `notification.ts`, `template.ts`, `analytics.ts`, `billing.ts`, `messaging.ts`, `webhook.ts`, `demo.ts`, `webrtc.ts`, `campaigns.ts`, `tenant.ts`, etc.).

**Build / package contract** (`packages/api-client/package.json`)

- `private: true`, `type: "module"`.
- Entry/exports point to source, not dist: `main/types/exports["."] = "./src/index.ts"`.
- Scripts: `type-check: tsc --noEmit`, `build: tsc --noEmit` (no emit), `lint/test` skipped.
- Deps: `@sanarwa/shared-types` (`workspace:*`), `axios`.
- TS config: `packages/api-client/tsconfig.json` extends `../../tsconfig.base.json`, `rootDir: src`, `outDir: dist`, `noEmit: true`, `types: ["node"]`.

**Exported surface** (`packages/api-client/src/index.ts`)

- Core client/types: `ApiClient`, `apiClient` (singleton), `createApiClient`, `getEnvironmentConfig`, `useTenantApiClient`, `ApiClientConfig`, `ApiError`, `ApiResponse`, `TokenStorage`.
- Auth/error/config: `authApi`, `ApiErrorHandler`, `setApiErrorToast`, `useApiErrorHandler`, `getApiConfig/getCompleteConfig/getCorsConfig/getCurrentEnvironment/getFeatureFlags/getLoggingConfig/getPerformanceConfig/getSecurityConfig/validateConfig`, etc.
- Domain modules: `apiKeyApi`, `projectApi`, `providerApi`, `notificationApi`, `templateApi`, `TemplateApiClient`, `analyticsApi`, `billingApi`, `webrtcApi`, `WebRTCApiClient`, `webrtcSignaling`, `WebRTCSignalingManager`.
- Namespace re-exports: `export * from "./messaging" | "./webhook" | "./demo" | "./campaigns" | "./tenant"`.

**Key behavioral contracts** (`packages/api-client/src/client.ts`)

- Base URL from `./env` (`apiRuntimeConfig.baseUrl`); Axios instance defaults: JSON, `withCredentials: true`, timeout 10s (configurable), retryAttempts 3.
- Token handling: browser `localStorage` token storage (`sanarwa_access_token`, `sanarwa_refresh_token`), Bearer injection, refresh flow via `POST /auth/refresh-token`, clears tokens and redirects to `/login` on auth failure (browser).
- Tenant scoping: sets `X-Tenant-ID` header when `tenantId` present; `resolvePath` replaces `:tenantId`/`:projectId`; tenant-scoped requests (default `tenantScoped: true`) throw `NO_TENANT_SELECTED` if missing.
- Error normalization: maps Axios/network errors to `ApiError` (`status/code/details/isAxiosError`) with special handling for 401/403/404/409/429; 429 and 5xx/network-style retry logic with backoff.
- Transport helpers: `get/post/put/patch/delete` wrappers + `connectWebSocket` (token query param, ws URL derived from baseURL).
- Exposes both singleton (`apiClient`) and factory/tenant helpers (`createApiClient`, `useTenantApiClient`).

**Consumed by**

- `apps/web` (declared dep in `apps/web/package.json`; extensive imports in `apps/web/src/**`, e.g. `contexts/tenant-context.tsx`, `hooks/use-*-`, auth/campaigns/projects/api-keys components importing `apiClient`, `authApi`, `tenantApi`, `campaignApi`, `projectApi`, `apiKeyApi`, `analyticsApi`, `billingApi`, `messagingApi`, etc.).

---

## 2) `packages/sdk` (`@sanarwa/sdk`)

**Ownership / purpose**

- Official/public TypeScript-JavaScript SDK for the Sanarwa notification API (external-consumer oriented). Provides a flat send/status/health surface and channel/template/analytics/notification-center components over a single Axios client.
- Documented in `packages/sdk/README.md`; drift/compatibility tracked in `packages/sdk/ENDPOINT-DRIFT.md` and enforced by `src/__tests__/endpoint-drift.test.ts` (per README).

**Build / package contract** (`packages/sdk/package.json`)

- `version: 0.2.0`, `type: "module"`, publish-oriented metadata (`description`, keywords, homepage/bugs/repo, `license: MIT`, `files: ["dist","README.md"]`).
- Bundled outputs: `main: dist/index.cjs`, `module: dist/index.js`, `types: dist/index.d.ts`; `exports["."]` maps import/require/types to `dist/*`.
- Scripts: `build: rollup -c`, `dev: rollup -c -w`, `test: vitest run`, `lint: oxlint -c ../../oxlint.json src`, `type-check: tsc --noEmit`.
- Deps: `axios`, `tslib`. Dev: Rollup + TS plugin + Vitest.
- TS config: `packages/sdk/tsconfig.json` extends base, `rootDir/src`, `outDir/dist`, declarations + maps, excludes tests/dist/node_modules. `packages/sdk/rollup.config.js` present (bundling implementation).
- Dist artifacts present under `packages/sdk/dist/` (`index.{js,cjs,d.ts}`, `client/types/transport` d.ts/maps), indicating built/packageable output.

**Exported surface** (`packages/sdk/src/index.ts`)

- `export { Sanarwa }` and default export, plus `export * from "./types"`.
- `Sanarwa` class (`packages/sdk/src/client.ts`): constructor accepts API key string or `{ key, baseUrl?, timeout? }`; defaults base URL `https://api.sanarwa.com/api/v1`, timeout 30s, headers `X-API-Key`, `Content-Type`, `User-Agent: sanarwa-sdk@0.2.0`.
- Composed channel/components: `email`, `sms`, `voice`, `inapp`, `push`, `whatsapp`, `analytics`, `templates`, `notificationCenter`, `transport` (from `./channels/*`, `./transport`).
- Top-level methods: `sendNotification`, `sendBulk`, `getNotificationStatus(trackingId)` → `GET /notifications/status/{trackingId}`, `getHealth()` → `GET /notifications/health`, plus `getDeliveryTimeline`, `getMessageStatus`, `getDeliveryStats` under `/messaging/*`.
- Error contract: response interceptor converts API error payloads to `Error("${apiError.error}: ${apiError.message}")`; network/other errors rethrown (as per README).
- Types (`packages/sdk/src/types.ts`): `NotificationChannel/Request/Response`, bulk types, `PaginatedResponse<T>`, `ApiError`, `TransportHealth`, WhatsApp/template/notification-center models; `NotificationRequest` aliases `TransportSendRequest` (flat API send shape).

**Consumed by**

- `@sanarwa/mcp` (`packages/mcp/package.json` dep `@sanarwa/sdk: workspace:*`; `mcp/src/server.ts` imports `Sanarwa`).
- `apps/api` declares `@sanarwa/sdk: workspace:*` in `apps/api/package.json` (cross-workspace contract/dependency at manifest level).
- Intended external consumers via published dist/package metadata (per README/install instructions).

---

## 3) `packages/ui` (`@sanarwa/ui`)

**Ownership / purpose**

- Shared React UI component library (Radix primitives + styling utilities), used by web app. Owns presentational/interactive primitives and token stylesheet export.

**Build / package contract** (`packages/ui/package.json`)

- `private: true`, `type: "module"`.
- Exports (source-based): `".": "./src/index.ts"`, `"./utils": "./src/utils.ts"`, `"./styles/tokens.css": "./src/styles/tokens.css"`, `"./*": "./src/*.tsx"` (subpath-per-component access).
- Scripts: `type-check`/`build` both `tsc --noEmit`, lint/tests skipped.
- Deps: Radix UI packages, `@tabler/icons-react`, `class-variance-authority`, `clsx`, `tailwind-merge`. Peer deps: `react`/`react-dom` ^19.
- TS config: `packages/ui/tsconfig.json` extends base, `jsx: react-jsx`, `noEmit`.

**Exported surface** (`packages/ui/src/index.ts`)

- Re-exports UI modules: `button, badge, card, input, label, checkbox, dialog, dropdown-menu, select, sheet, tabs, tooltip, avatar, separator, skeleton, empty, alert, switch, progress, popover, scroll-area, slider, table, textarea, collapsible, date-range-picker` plus `cn` from `./utils` and `Icon` from `./icon`.
- Corresponding source files exist under `packages/ui/src/*.tsx` and `utils.ts` (and styles subpath per exports).

**Consumed by**

- `apps/web` (`apps/web/package.json` dep `workspace:*`; many imports in `apps/web/src/**`, e.g. `@sanarwa/ui/button`, `@sanarwa/ui/card`, `@sanarwa/ui/input`, `@sanarwa/ui/dialog`, etc., including component-level subpaths).

---

## 4) `packages/assets` (`@sanarwa/assets`)

**Ownership / purpose**

- Brand asset package: React logo components and canonical asset path map for favicons/logos/OG image.

**Build / package contract** (`packages/assets/package.json`)

- `private: true`, `type: "module"`.
- Exports (source/static paths): `".": "./src/index.ts"`, `"./logos/*"`, `"./icons/*"`, `"./favicon/*"` (all under `src/`).
- Scripts: `type-check`/`build` `tsc --noEmit`, lint/tests skipped.
- Peer deps: `react`/`react-dom` ^19. Dev: React types + TS.
- TS config: `packages/assets/tsconfig.json` extends base, `jsx: react-jsx`, `rootDir/outDir src/dist`, `noEmit`.

**Exported surface** (`packages/assets/src/index.ts`)

- Components: `SanarwaMark`, `SanarwaWordmark` (from `./logos/*`).
- `brandAssets` const map: `favicon`, `faviconPng`, `appleTouchIcon`, `ogImage`, `logoMark`, `logoWordmark` (string paths) and `BrandAssetKey` type.

**Consumed by**

- `apps/web` (`apps/web/package.json` dep `workspace:*`; imports observed such as `brandAssets` in `apps/web/src/routes/__root.tsx` and `SanarwaMark` in auth layout components under `apps/web/src/components/auth/*`).

---

## 5) `packages/config` (`@sanarwa/config`)

**Ownership / purpose**

- Shared configuration package, primarily TypeScript config presets for the monorepo.

**Build / package contract** (`packages/config/package.json`)

- `private: true`, no runtime source/build output.
- Exports: `./tsconfig/base -> ./tsconfig.base.json`, `./tsconfig/react -> ./tsconfig.react.json`, `./tsconfig/node -> ./tsconfig.node.json`.
- Scripts are placeholders (`build/lint/test/type-check` echo/no-op behavior).

**Preset contracts**

- `packages/config/tsconfig.base.json`: ES2022, DOM+iterable libs, `module: ESNext`, `moduleResolution: bundler`, strictness flags (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`), declarations/maps, `isolatedModules`.
- `packages/config/tsconfig.react.json`: extends local base, `jsx: react-jsx`, `noEmit`.
- `packages/config/tsconfig.node.json`: extends local base, `module: CommonJS`, `moduleResolution: node`, `noEmit: false`, `outDir: dist`.

**Consumed by / boundary note**

- Other packages in-tree mostly `extends: "../../tsconfig.base.json"` (repo-root base) rather than importing `@sanarwa/config/tsconfig/*` directly in the files inspected (`api-client`, `sdk`, `ui`, `shared-types`, `mcp`, `assets` tsconfigs). The package defines a reusable preset surface for consumers, but direct in-repo usage was not evidenced in this pass.

---

## 6) `packages/shared-types` (`@sanarwa/shared-types`)

**Ownership / purpose**

- Small shared TypeScript contract/types package for cross-workspace domain/API primitives.

**Build / package contract** (`packages/shared-types/package.json`)

- `private: true`, `type: "module"`.
- Source-exported: `main/types/exports["."] = "./src/index.ts"`.
- Scripts: `type-check`/`build` `tsc --noEmit`, lint/tests skipped.
- TS config: `packages/shared-types/tsconfig.json` extends base, `noEmit`.

**Exported surface** (`packages/shared-types/src/index.ts`)

- `Environment` union.
- Generic API/pagination/error shapes: `PaginationMeta`, `ApiErrorDetail`, `ApiResponse<T>`.
- Domain summaries/models: `TenantSummary`, `ProjectSummary`, `CampaignStatus` (status union), `TemplateChannel`, `ProviderType`, `AuthTokens`, `UserProfile`.

**Consumed by**

- `@sanarwa/api-client` depends on it (`workspace:*`).
- `apps/web/package.json` and `apps/api/package.json` both declare `@sanarwa/shared-types: workspace:*` (shared contract boundary; direct import sites not exhaustively enumerated in this pass).

---

## 7) `packages/mcp` (`@sanarwa/mcp`)

**Ownership / purpose**

- MCP server exposing Sanarwa notification API operations as agent tools (send/status/analytics/health/push/whatsapp) over stdio or Streamable HTTP. Bridges MCP tool schemas to `@sanarwa/sdk` calls and enforces API/spec/route alignment via manifest + drift tests.
- Documented in `packages/mcp/README.md`.

**Build / package contract** (`packages/mcp/package.json`)

- `version: 0.1.0`, `type: "module"`, publish-oriented metadata, `files: ["dist"]`.
- Compiled package: `main: ./dist/index.js`, `types: ./dist/index.d.ts`, `bin: { "sanarwa-mcp": "./dist/index.js" }`, `exports["."]` -> `dist`.
- Scripts: `build/dev: tsc -p tsconfig.json [--watch]`, `test: vitest run`, `type-check: tsc -p tsconfig.json --noEmit`.
- Deps: `@modelcontextprotocol/sdk`, `@sanarwa/sdk` (`workspace:*`), `zod`. Dev: TS, Vitest, Node types.
- TS config: `packages/mcp/tsconfig.json` extends base, `outDir/dist`, declarations/maps, `module/moduleResolution: NodeNext`, excludes tests/dist.
- `dist/` and `vitest.config.ts` present.

**Exported/runtime surface** (`packages/mcp/src/index.ts`, `src/server.ts`, `src/config.ts`, `src/manifest.ts`)

- Entrypoint/runtime (`src/index.ts`): `main(argv)`; transport selection `--stdio|--http` or `SANARWA_MCP_TRANSPORT`; stdio via `StdioServerTransport`; HTTP via Node HTTP server + `StreamableHTTPServerTransport` (session map), `/health` endpoint, default MCP bind/port from config.
- Config (`src/config.ts`): `resolveConfig(env)` (zod) requires `SANARWA_API_KEY`, defaults `SANARWA_BASE_URL=https://api.sanarwa.com/api/v1`, `SANARWA_MCP_PORT=3400`, `SANARWA_MCP_HOST=127.0.0.1`; throws `ConfigError`.
- Server/tools (`src/server.ts`): `createServer(client: Sanarwa)` registers 9 tools — `notification_send`, `notification_send_bulk`, `notification_status`, `notification_analytics`, `notification_health`, `push_send`, `push_send_bulk`, `whatsapp_send`, `whatsapp_send_template`; wraps results as MCP text/structured content and converts failures to `isError` tool results. `createClient()` builds `Sanarwa` from API key/base URL/timeout.
- Contract/consistency manifest (`src/manifest.ts`): `OPERATION_BINDINGS` maps each tool to HTTP `method`, OpenAPI `specPath`, and actual SDK-called `path` (e.g. push/whatsapp send routed through `/notifications/send`). README states drift tests fail on spec/tool mismatch, duplicate claims, removed operations, or routes not served by API controllers.

**Consumed by**

- External/agent hosts (Claude Desktop, Cursor, HTTP MCP clients) as a CLI/server (`sanarwa-mcp` bin, `dist/index.js`). No in-repo app imports observed in this pass; it consumes `@sanarwa/sdk` internally.

---

## Cross-workspace boundaries and notable contracts

- **Web app boundary (`apps/web`)**: depends on and imports `@sanarwa/api-client`, `@sanarwa/ui`, `@sanarwa/assets`, `@sanarwa/shared-types`. Web code uses `api-client` for authenticated/tenant-aware API access (e.g. `apiClient`, `tenantApi`, domain APIs) and `ui/assets` for presentation. This is the primary in-app consumer boundary for internal UI/data-access packages.
- **API boundary (`apps/api`)**: manifest depends on `@sanarwa/sdk` and `@sanarwa/shared-types` (workspace deps). No `apps/api/src` imports of `@sanarwa/*` were found by textual search in this pass, so runtime coupling beyond declared dependencies was not evidenced here.
- **External/API-consumer boundary**: `@sanarwa/sdk` is the public programmatic client (dist ESM+CJS+types, README/API contract, endpoint-drift compatibility checks). `@sanarwa/mcp` is an agent-facing adapter over that SDK (compiled dist/bin, env-driven config, OpenAPI/controller drift guardrails).
- **Source-vs-dist consumption split**:
  - `api-client`, `ui`, `assets`, `shared-types`, `config` are source-exported / private workspace packages (exports point at `src` or JSON/assets; build scripts largely `tsc --noEmit` or placeholders).
  - `sdk` and `mcp` produce and expose `dist` artifacts (and `mcp` has a CLI bin), aligning with external/tooling consumption.
- **Two different client contracts (important boundary)**:
  - `@sanarwa/api-client`: session/token + `X-Tenant-ID` + tenant-scoped path resolution + browser-oriented storage/redirect behavior; broad internal domain modules.
  - `@sanarwa/sdk`: API-key (`X-API-Key`) flat notification API client (`to/channel/message`), channel components, tracking-id/status semantics, and endpoint-drift-tested compatibility for external/integration use.
- **Shared type boundary**: `@sanarwa/shared-types` provides common DTO-like shapes (`ApiResponse`, pagination/errors, tenant/project/campaign/template/provider/auth/user types) depended on by `api-client` and declared by both apps.

## Files read / evidence anchors

- Workspace: `package.json`, `pnpm-workspace.yaml`
- Packages: each `packages/*/package.json`, `packages/*/tsconfig*.json` (where present), `packages/*/src/index.*`, `packages/sdk/README.md`, `packages/sdk/ENDPOINT-DRIFT.md` (presence), `packages/mcp/README.md`, key implementation files `packages/api-client/src/client.ts`, `packages/sdk/src/{client.ts,types.ts}`, `packages/mcp/src/{index.ts,server.ts,config.ts,manifest.ts}`
- Apps (usage/deps): `apps/web/package.json`, `apps/api/package.json`, and `apps/web/src/**` / `apps/api/src/**` import scans for `@sanarwa/*`
