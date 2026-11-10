# [005] Web app architecture and flows

- **Label:** `wayfinder:research`
- **Status:** closed (resolved)
- **Parent map:** [Whole-repo understanding map](../MAP-001-whole-repo-understanding.md)
- **Blocked by:** none (informed by [002], [004])
- **Blocks:** none (informs fog graduation)

## Question

How is `apps/web` (TanStack Start + React) structured and how do its key flows work — routing/layouts, data/query and state layers (`lib/query`, `lib/data`, contexts/stores), auth/session and tenant/project selection, consumption of `@sanarwa/api-client`, `@sanarwa/ui`, and `@sanarwa/assets`, and the major user-facing surfaces — stated clearly enough to navigate and explain the frontend architecture? If understanding reveals concrete correctness/stability issues, scoped fixes or refactors may be included.

## Resolution

# [005] Web app architecture and flows — `apps/web` (TanStack Start + React)

## Scope & method

- **Thoroughness:** medium (targeted inventory + key implementation reads).
- **Primary sources read:**
- `apps/web/package.json`, `apps/web/vite.config.ts`
- Routing: `apps/web/src/routes/**` (inventory), `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/$tenantSlug.tsx`, `apps/web/src/routes/$tenantSlug/dashboard.tsx`, `apps/web/src/routes/dashboard.tsx`, `apps/web/src/routes/login.tsx`, `apps/web/src/routeTree.gen.ts` (partial)
- Query/data/auth/session: `apps/web/src/lib/query/query-client.ts`, `apps/web/src/lib/query/query-provider.tsx`, `apps/web/src/lib/query/index.ts`, `apps/web/src/lib/query/hooks/use-tenant-queries.ts`, `apps/web/src/lib/query/hooks/use-auth-queries.ts`, `apps/web/src/lib/session.ts`, `apps/web/src/lib/better-auth-client.ts`, `apps/web/src/lib/auth/post-auth-redirect.ts`, `apps/web/src/lib/tenant-path.ts`, `apps/web/src/lib/data/troubleshooting-data.ts`, `apps/web/src/lib/data/sdk-examples.ts`
- Contexts/providers/stores/guards: `apps/web/src/contexts/auth-context.tsx`, `apps/web/src/contexts/tenant-context.tsx`, `apps/web/src/components/layout/tenant-layout-guard.tsx`, `apps/web/src/components/layout/tenant-slug-sync.tsx`, `apps/web/src/components/layout/tenant-route-redirect.tsx`, `apps/web/src/hooks/use-tenant-slug.ts`
- Surfaces/examples: `apps/web/src/pages/tenantSlug-dashboard.tsx`
- Structure scans: `apps/web/src/components/**` (dirs), `apps/web/src/pages/**` (inventory)
- Internal-package usage scan: `grep -rn "@sanarwa/(api-client|ui|assets)" apps/web/src`
- **No files modified, no branches created.** Findings below are research; any fixes/refactors are recommendations only (not applied).

## 1) Stack, build, and app entry

### Package & scripts (`apps/web/package.json`)

- **Framework/runtime:** TanStack Start + TanStack Router + React 19 + Vite 7 + Nitro 3 (`@tanstack/react-start ^1.114.29`, `@tanstack/react-router ^1.114.29`, `react ^19.1.0`, `vite ^7.0.0`, `nitro ^3.0.0`).
- **Server/data:** `@tanstack/react-query ^5.90.1` (+ devtools), `better-auth ^1.7.14`.
- **Workspace deps:** `@sanarwa/api-client`, `@sanarwa/assets`, `@sanarwa/shared-types`, `@sanarwa/ui`.
- **UI/forms/styling/content:** extensive Radix primitives, Tailwind v4, `class-variance-authority`/`clsx`/`tailwind-merge`, `react-hook-form` + `@hookform/resolvers` + `zod`, `sonner`, `next-themes`, TipTap, Recharts, dnd-kit, icons, etc.
- **Other notable deps:** `@reduxjs/toolkit`, `react-redux`, `redux-persist`, `framer-motion`, `js-cookie` are present (state-related surface exists in deps; wiring not exhaustively traced in this pass).
- **Scripts:** `dev` = `vite dev`, `build` = `vite build`, `start` = `node.output/server/index.mjs`, `lint`/`type-check`/`test` via oxlint/tsc/vitest. (Repo-wide gate expectations are defined in root `AGENTS.md`; web-specific type-check baseline is known to be red per that doc.)

### Vite/TanStack Start config (`apps/web/vite.config.ts`)

- `defineConfig` with `server.port = 3000`.
- Plugins: `tsconfigPaths()`, `tanstackStart({ srcDirectory: "src", router: { routesDirectory: "routes" } })`, `viteReact()`, `tailwindcss()`, `nitro()`.
- File-based routing is rooted at `apps/web/src/routes`; generated route tree is `apps/web/src/routeTree.gen.ts` (auto-generated, do-not-edit).

### Root document & provider composition (`apps/web/src/routes/__root.tsx`)

- `createRootRoute` defines document `head` (charset/viewport/title/description/theme-color), global stylesheet (`@/styles/globals.css?url`), favicon from `@sanarwa/assets` (`brandAssets.favicon`), manifest, and Google fonts; `component: RootComponent`.
- `RootComponent` renders full HTML shell: `<HeadContent/>`, `<SkipLinks/>`, perf/SW/monitoring helpers, and a nested provider stack around `<Outlet/>`:

1.  `QueryProvider` (`@/lib/query`)
2.  `ThemeProvider` (`next-themes` wrapper, `attribute="class"`, `defaultTheme="system"`)
3.  `AuthProvider` (`@/contexts/auth-context`)
4.  `TenantProvider` (`@/contexts/tenant-context`)
5.  `BrandingProvider`
6.  `MonitoringProvider` → `UserBehaviorTracker` → `AppShell(Outlet)`
7.  `Toaster` (sonner) + `PerformanceDebugger`

- **Implication:** auth/tenant/branding/query are globally mounted at app root for all routes (including public/auth pages), not only under `/$tenantSlug`.

## 2) Routing model, layouts, and major user-facing surfaces

### Route tree shape (`apps/web/src/routes/**`, `apps/web/src/routeTree.gen.ts`)

- **Public/top-level examples:** `/` (`index`), `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth`, `/oauth/callback`, `/accept-invitation.$invitationId`, `/pricing`, `/docs` (+ `docs/sdks`, `docs/sdks/javascript`, `docs/playground`, `docs/examples`, `docs/troubleshooting`), `/onboarding`, `/theme-demo`, `/dashboard-demo`, `/offline`, `/unauthorized`.
- **Tenant-scoped layout route:** `/$tenantSlug` (`apps/web/src/routes/$tenantSlug.tsx`) wraps children with `TenantLayoutGuard` + `TenantSlugSync` + `<Outlet/>`.
- **Tenant child surfaces (under `/$tenantSlug`):** `dashboard`, `projects`, `projects/$projectId`, `providers`, `providers/$providerId`, `channels`, `messages`, `messages/$id`, `templates`, `campaigns`, `campaigns/$id`, `analytics`, `webhooks`, `api-keys`, `settings`, `billing`, `monitoring`, `workflows`.
- **Parallel/ non-tenant routes also exist at root:** e.g. `dashboard`, `analytics`, `campaigns`, `campaigns/$id`, `monitoring`, `templates`, `templates/email`, `workflows`, `settings/tenant`, `settings/branding`, `settings/team` (see `routes/*.tsx` and generated imports).

### Tenant layout & access control

- `apps/web/src/routes/$tenantSlug.tsx`: pathless-layout-like parent for tenant segment; delegates enforcement/sync to layout components.
- `apps/web/src/components/layout/tenant-layout-guard.tsx`:
- Reads `isAuthenticated`, `isLoading` from `useAuth()` and `tenantSlug` from route params.
- On unauthenticated (after load) → `navigate` to `/login` with `search.redirect = "/{tenantSlug}/dashboard"`.
- While loading: spinner; unauthenticated after effect: `null`.
- **Also wraps children in `<TenantProvider>` again** (nested under root’s `TenantProvider`).
- `apps/web/src/components/layout/tenant-slug-sync.tsx` → calls `useEnsureTenantFromSlug()` (`apps/web/src/hooks/use-tenant-slug.ts`) to align selected tenant with URL slug and canonicalize path.

### Non-tenant → tenant redirect pattern

- `apps/web/src/routes/dashboard.tsx`: `component: () => <TenantRouteRedirect suffix="dashboard" />`.
- `apps/web/src/components/layout/tenant-route-redirect.tsx`:
- If loading: wait; if unauthenticated: redirect to `/login` with `redirect = "/{suffix}"`.
- If authenticated: `tenantApi.getMyTenants({ limit: 50 })` then navigate to `/{getTenantPathSegment(first)}/{suffix}` or `/onboarding` on empty/error.
- Renders spinner (or children) while resolving.
- This establishes a pattern where “global” convenience routes resolve the active workspace and forward into tenant-scoped URLs.

### Route → page composition pattern

- Routes are thin wrappers that bind `createFileRoute(...).component` to page components, e.g.:
- `apps/web/src/routes/$tenantSlug/dashboard.tsx` → `@/pages/tenantSlug-dashboard`
- `apps/web/src/routes/login.tsx` → `@/pages/login`
- Pages live under `apps/web/src/pages/**` (inventory includes `tenantSlug-dashboard.tsx`, `tenantSlug-providers*.tsx`, `tenantSlug-projects*.tsx`, `home.tsx`, docs/auth/settings/demo pages, etc.), indicating a separation where `routes/` defines URL mapping and `pages/` holds screen implementations.
- Example tenant dashboard surface (`apps/web/src/pages/tenantSlug-dashboard.tsx`):
- `"use client"`; uses `AppShell`, `DashboardOverview`, `Button` from `@sanarwa/ui/button`, tenant hooks/context, and compat link/navigation.
- Calls `useEnsureTenantFromSlug()` and derives `basePath` via `useTenantBasePath()`.
- Handles loading, “workspace not found” (CTA to `/onboarding`), then renders header + `<DashboardOverview />` within `max-w-7xl` layout and tenant-aware nav links (`${basePath}/messages`, `${basePath}/analytics`).

### Major user-facing surface areas (by module)

- **Workspace/tenant management:** onboarding, tenant settings/branding/team/billing, projects, API keys, webhooks (`routes/$tenantSlug/*`, `routes/settings/*`, `components/tenant`, `components/projects`, `components/api-keys`, `components/billing`, `components/branding`).
- **Messaging & delivery ops:** dashboard, messages (+ detail), campaigns (+ detail/wizard), templates (incl. email editor), channels/providers (list/detail/metrics/config/setup), analytics, monitoring (`components/dashboard`, `messages`, `campaigns`, `templates`, `channels`, `providers`, `analytics`, `monitoring`).
- **Channels/setup:** email/sms/push/whatsapp/in-app components and setup flows (`components/email|sms|push|whatsapp|in-app|channels`).
- **Docs/marketing/supporting:** docs/playground/examples/troubleshooting/sdks pages, landing/marketing components, pricing, theme/dashboard demos, offline/unauthorized (`components/docs`, `components/marketing`, `lib/data/sdk-examples.ts`, `lib/data/troubleshooting-data.ts`).
- **Cross-cutting UI/infra:** layout, auth, accessibility, performance, theme, error-boundary, shared UI wrappers (`components/layout`, `auth`, `accessibility`, `performance`, `theme`, `error-boundary`, `ui`).

## 3) Data, query, and state layers

### TanStack Query client & conventions (`apps/web/src/lib/query/query-client.ts`)

- Single exported `queryClient` with defaults:
- Queries: `staleTime 5m`, `gcTime 10m`, retry up to 3 except 4xx, exponential backoff (cap 30s), `refetchOnWindowFocus: true`, `refetchOnReconnect: "always"`.
- Mutations: retry up to 1 except 4xx.
- Central `queryKeys` factory for `auth`, `tenants`, `campaigns`, `workflows`, `templates`, `analytics` (parameterized by tenant/resource/date/filter where relevant).
- `invalidateQueries` helpers for auth/tenant/campaign/workflow/template/analytics to fan out invalidations consistently.
- **Note:** key coverage is partial vs all feature domains present in routes/components (e.g. providers/messages/billing/projects not represented in this core key map).

### Query provider (`apps/web/src/lib/query/query-provider.tsx`)

- `"use client"`; wraps children in `QueryClientProvider` with singleton client; renders `ReactQueryDevtools` only when `process.env.NODE_ENV === "development"`.

### Query module surface (`apps/web/src/lib/query/index.ts`)

- Re-exports client/keys/invalidation/provider, error-handling helpers, and broad hook exports:
- Direct: `use-analytics-queries`, `use-auth-queries`, `use-provider-queries`, `use-tenant-queries`.
- Aliased notification hooks (e.g. `useSendNotification` exported as create/update-like names, `useInAppNotifications` as `useNotifications`, etc.), mapping onto `use-notification-queries`.
- `apps/web/src/lib/query/hooks/**` inventory includes auth/tenant/provider/notification/analytics/channel and channel-setup hooks (email/sms/push/whatsapp, in-app feed) plus tests for notification queries.

### API access patterns in query/hooks

- **Generic client usage:** e.g. `apps/web/src/lib/query/hooks/use-tenant-queries.ts` imports `apiClient` from `@sanarwa/api-client` and calls `apiClient.get/post/patch/delete(...)` with explicit paths and `tenantScoped` hints; mixes optimistic updates/invalidation (`useUpdateTenantBranding`).
- **Typed/domain API modules:** many feature modules use domain clients from `@sanarwa/api-client` (e.g. `tenantApi`, `campaignApi`, `analyticsApi`, `messagingApi`, `billingApi` seen in scans/usages).
- **Hybrid reality:** some flows go through React Query hooks; others call API modules directly in components/contexts/redirect helpers (see tenant context and route redirect below).

### React contexts as state layer

- **Auth (`apps/web/src/contexts/auth-context.tsx`)**
- Built on `authClient` (Better Auth client) `useSession()` as source of truth.
- Exposes `user`, `isAuthenticated`, `isLoading` (`isPending`), `error`, `permissions` (always `[]`), and actions: `login`/`register` (email/password via Better Auth), `logout`, `refreshUser` (`getSession()`), `clearError`, `clearTokens` (calls `signOut`).
- Re-exports `authClient`.
- **Tenant/workspace (`apps/web/src/contexts/tenant-context.tsx`)**
- `useReducer` state: `currentTenant`, `tenants`, `memberships` (loaded as empty array), `invitations`, `isLoading`, `error`.
- `refreshTenants` (auth-gated): loads `tenantApi.getMyTenants({limit:50})` and `tenantApi.getCurrentTenant()` in parallel, dispatches tenants/current tenant.
- Actions: `switchTenant` (`setCurrentTenant` + fetch tenant + audit log), `create/update/delete` tenant, invite/update/remove member (partly via `tenantApi`, partly dispatch expectations not fully implemented for member mutations).
- Effects: refresh on auth; `apiClient.setTenant(state.currentTenant?.id ?? null)` whenever current tenant/auth changes.
- Exposes `selectedTenant` alias to `currentTenant`.
- **Other providers in root:** `BrandingProvider`, `MonitoringProvider`, `ThemeProvider`, `UserBehaviorTracker` (implementations not fully read here) participate in global app state/behavior.

### Client-side data helpers (`apps/web/src/lib/data/*`)

- `sdk-examples.ts`: static SDK/REST example catalog (`sdkExamples`, `apiEndpoints`) for docs/playground surfaces (includes `/notifications/*` endpoint examples and JS snippets).
- `troubleshooting-data.ts`: static troubleshooting knowledge base (items with symptoms/causes/solutions/code/tags) for support/docs UI.

## 4) Auth/session and tenant/project selection flows

### Better Auth client integration (`apps/web/src/lib/better-auth-client.ts`)

- `"use client"`; creates `createAuthClient` with organization plugin + custom access control roles (`owner/admin/member/viewer`) and member schema extensions.
- `baseURL()` derives from `VITE_API_URL` (if set) + `/api/auth`, else defaults to `http://localhost:3000/api/auth`; fixed `basePath = "/api/auth"`.
- Exports `authClient`, `useBetterAuthClient`, `AuthClient` type.
- **Alignment note:** repo `AGENTS.md` states Better Auth is mounted in API (`apps/api/src/main.ts` via `betterAuthHandler`); this file is the web-side client against that mounted auth surface.

### Session helpers (`apps/web/src/lib/session.ts`)

- `fetchSession()`, `fetchOrganizations()`, `fetchActiveOrganization()`, `fetchActiveMember()` wrap `authClient` calls.
- `requireSession()` redirects unauthenticated users to `/login` with `redirect` search param (uses `location.pathname` when available). Intended for guarded flows/loaders, but adoption across routes was not exhaustively verified in this pass.

### Post-auth navigation

- `apps/web/src/lib/auth/post-auth-redirect.ts`: `redirectAfterAuth(router)` fetches `tenantApi.getMyTenants({limit:50})`, routes to first tenant dashboard (`/{segment}/dashboard`) or `/onboarding`; on error shows toast and falls back to `/onboarding`.
- `apps/web/src/components/layout/tenant-route-redirect.tsx` performs the same “resolve tenant → redirect” behavior for route-level convenience paths.

### Tenant slug & selection flow

- `apps/web/src/lib/tenant-path.ts`: canonical segment resolution and matching (`subdomain || slug || id`).
- `apps/web/src/hooks/use-tenant-slug.ts`:
- `useTenantSlug()` reads `tenantSlug` from route params.
- `useTenantBasePath()` prefers selected tenant segment, else URL slug.
- `useEnsureTenantFromSlug()` finds matching tenant in `TenantContext.tenants`, auto-`switchTenant` if mismatch, and canonicalizes URL (replace `/:tenantSlug` prefix with canonical segment, preserving remainder/defaulting to `/dashboard`).
- `TenantSlugSync` (`apps/web/src/components/layout/tenant-slug-sync.tsx`) runs this hook for all `/$tenantSlug/*` routes.
- `TenantProvider` keeps `apiClient.setTenant(currentTenant.id)` in sync so tenant-scoped API calls target the selected workspace.

### Project selection

- Routes include `/$tenantSlug/projects` and `/$tenantSlug/projects/$projectId` and corresponding page components; project-specific selection/state logic was not deeply traced beyond routing/surface inventory in this medium pass.

## 5) Consumption of internal packages

### `@sanarwa/api-client`

- **Usage style:** both typed domain modules and generic `apiClient`.
- Generic: `apiClient` imported in `contexts/tenant-context.tsx`, `lib/query/hooks/use-tenant-queries.ts`, `hooks/use-dashboard-data.ts` (per scan), with REST-style paths and tenant scoping controls.
- Domain APIs seen in sampled files/scans: `tenantApi` (`contexts/tenant-context.tsx`, redirects/post-auth, layout redirect), `campaignApi` (campaign components/wizard/details hooks), `analyticsApi`/`messagingApi`/`billingApi` (hooks/pages per grep results).
- **Observed role:** primary transport boundary from web to backend; tenant context also programs client tenant scope (`setTenant`).

### `@sanarwa/ui`

- **Usage style:** component-level imports from package subpaths (common in sampled campaign/wizard UI): `@sanarwa/ui/button`, `@sanarwa/ui/card`, `@sanarwa/ui/input`, `@sanarwa/ui/select`, `@sanarwa/ui/tabs`, `@sanarwa/ui/badge`, etc.
- **Observed role:** shared design-system primitives consumed broadly across feature components/pages (campaigns sampled extensively; also dashboard/auth/layout surfaces import UI primitives).

### `@sanarwa/assets`

- **Usage observed:** `brandAssets` imported in `apps/web/src/routes/__root.tsx` to supply favicon (`brandAssets.favicon`).
- **Observed role:** brand/static asset source for app shell metadata (other usages may exist but were not prominent in scan).

## 6) Major flows (end-to-end, as implemented)

### App bootstrap

1. TanStack Start serves routed app (`vite.config.ts`, `routeTree.gen.ts`).
2. Root route renders document shell + global providers + `<Outlet/>` (`routes/__root.tsx`).
3. Query/auth/tenant contexts initialize; `TenantProvider` refreshes tenants when authenticated and syncs tenant id into `apiClient`.

### Authentication

1. User hits `/login` route wrapper → login page.
2. `AuthProvider` uses Better Auth session state; `login/register` call `authClient.signIn.email` `signUp.email`.
3. Post-auth flows (e.g. `redirectAfterAuth`, `TenantRouteRedirect`) resolve memberships via `tenantApi.getMyTenants` and navigate to tenant dashboard or onboarding.
4. Guards (`TenantLayoutGuard`, redirect helpers) enforce auth and route users appropriately.

### Tenant/workspace selection & tenant-scoped navigation

1. Enter `/$tenantSlug/*` → `TenantLayoutGuard` enforces auth (and nests tenant provider) → `TenantSlugSync` aligns URL/context.
2. `useEnsureTenantFromSlug` matches slug to known tenant, switches active tenant in context if needed, and rewrites URL to canonical segment.
3. Tenant-scoped pages/components derive base paths via `useTenantBasePath`/`tenant-path` utilities and issue tenant-aware API calls (via context-configured `apiClient` and/or tenant-scoped endpoints).

### Feature data flow (typical)

- **React Query path:** hooks in `lib/query/hooks/*` use `queryKeys`/`queryClient` and `@sanarwa/api-client` (generic or domain APIs), with invalidation/optimism patterns in places (e.g. tenant branding).
- **Direct/context path:** contexts and some components/helpers call domain APIs directly (e.g. tenant context CRUD, `TenantRouteRedirect`, campaign wizard/components), sometimes bypassing centralized query cache.
- **UI composition:** routes → pages (`apps/web/src/pages/*`) → feature components (`apps/web/src/components/*`) using `@sanarwa/ui` primitives and internal hooks/contexts.

## 7) Concrete correctness/stability issues observed (not fixed)

> Grounded in read files/scans; recommended as scoped follow-ups.

1. **`TenantProvider` is mounted twice in the tenant path**

- **Evidence:** root mounts `<TenantProvider>` in `apps/web/src/routes/__root.tsx`; tenant layout guard mounts `<TenantProvider>` again in `apps/web/src/components/layout/tenant-layout-guard.tsx` around guarded children.
- **Impact/risk:** duplicate tenant state trees/effects (`refreshTenants`, `apiClient.setTenant`) can cause redundant fetches, state divergence between providers, and confusing context resolution depending on consumer location.

2. **Auth React Query hooks are structurally inconsistent with `useAuth()` contract** (`apps/web/src/lib/query/hooks/use-auth-queries.ts`, `apps/web/src/contexts/auth-context.tsx`)

- **Evidence:** `useCurrentUser` does `const { data: user, isLoading, error } = useAuth()` but `AuthProvider` exposes `{ user, isLoading, error,... }` (no `data`); `useIsAuthenticated` same pattern. `useLogin`/`useRegister` call `useAuth()` and expect mutation responses shaped as `{ user }` to seed cache, but context methods rethrow Better Auth responses/errors and may not normalize to that shape.
- **Impact/risk:** broken/undefined query results, incorrect cache seeding/invalidation behavior, and misleading auth state for consumers of these hooks.

3. **Invalid hook usage and runtime bugs inside query/mutation callbacks** (`apps/web/src/lib/query/hooks/use-auth-queries.ts`)

- **Evidence:** `usePermissions` declares `queryFn: async () => { const user = await useAuth();... }` (calling a React hook inside query function). `useEmailVerification`/`useResendVerificationEmail` reference `queryClient.invalidateQueries.auth()` (not a valid TanStack Query API/property) and call `invalidateQueries.auth()` helper defined as a no-op later in file. `useAutoTokenRefresh` calls `getTimeUntilExpiry()` but only destructures `refreshSession, isTokenExpired, isAuthenticated` from `useSession()`.
- **Impact/risk:** hook-rule violations, thrown runtime errors, and ineffective session/verification refresh logic.

4. **Invitation, password-reset, and parts of tenant-query flows are stubbed/no-op** (`apps/web/src/lib/query/hooks/use-tenant-queries.ts`, `apps/web/src/lib/query/hooks/use-auth-queries.ts`)

- **Evidence:** several mutations/queries return `Promise.resolve(...)` placeholders (invitations CRUD/accept/decline/cancel, password reset request/confirm) instead of real API calls.
- **Impact/risk:** UI can appear wired but perform no backend action; hard to reason about feature completeness and error handling.

5. **Route duplication parallel URL schemes for same domains** (`apps/web/src/routes/**`, `routeTree.gen.ts`)

- **Evidence:** both root-level and tenant-scoped variants exist for areas like dashboard, analytics, campaigns, monitoring, templates, workflows, settings; root `dashboard` explicitly redirects via `TenantRouteRedirect`, while others may have independent implementations.
- **Impact/risk:** drift between tenant and non-tenant screens, inconsistent auth/tenant enforcement, duplicated maintenance, and ambiguous canonical navigation targets.

6. **Potential naming/API ambiguity: `useTenant` exported from multiple layers**

- **Evidence:** `useTenant` context hook in `apps/web/src/contexts/tenant-context.tsx` and `useTenant` query hook in `apps/web/src/lib/query/hooks/use-tenant-queries.ts` (also re-exported via query index).
- **Impact/risk:** easy to import the wrong hook; semantics differ (context state/actions vs fetched tenant record), increasing correctness risk during refactors.

7. **Slug canonicalization depends on browser-only `window` during effect** (`apps/web/src/hooks/use-tenant-slug.ts`)

- **Evidence:** reads `window.location.pathname` in `useEffect` to compute remaining path before `navigate(..., { replace: true })`.
- **Impact/risk:** generally safe in client effects, but brittle for SSR/transition timing and harder to test; path preservation logic may behave unexpectedly for nested/edge paths.

8. **Session token/expiry helpers are largely placeholder semantics** (`apps/web/src/lib/query/hooks/use-auth-queries.ts`)

- **Evidence:** `useSession().getTokenInfo()` returns `token: user.id` and `isExpired: false` when user exists; `getTimeUntilExpiry()` returns `0`; auto-refresh relies on these values.
- **Impact/risk:** can trigger misleading refresh behavior or provide incorrect security/session diagnostics if consumed by UI/guards.

## 8) Bottom line for navigation/explanation

- **Architecture style:** TanStack Start file-based routing (`src/routes`) with thin route modules delegating to screen components in `src/pages`, feature UI in `src/components/*`, and a mixed data layer of React Query hooks plus direct `@sanarwa/api-client` calls.
- **Global app shell:** a single root provider stack wires query, theme, auth (Better Auth client-backed), tenant, branding, monitoring, toasts, and perf tooling for the whole app.
- **Tenancy model in web:** workspace context is first-class; tenant-scoped UX is primarily under `/$tenantSlug/*` with slug-to-tenant resolution/canonicalization and client tenant scoping, while several /global routes still exist (some redirecting to tenant paths).
- **Most useful entry points to understand behavior:** `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/$tenantSlug.tsx`, `apps/web/src/components/layout/*tenant*`, `apps/web/src/contexts/auth-context.tsx`, `apps/web/src/contexts/tenant-context.tsx`, `apps/web/src/lib/better-auth-client.ts`, `apps/web/src/lib/query/*`, and `apps/web/src/pages/tenantSlug-*.tsx`.
