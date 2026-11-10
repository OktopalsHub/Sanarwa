# [008] Authn, authz, and identity

- **Label:** `wayfinder:research`
- **Status:** closed (resolved)
- **Parent map:** [Whole-repo understanding map](../MAP-001-whole-repo-understanding.md)
- **Blocked by:** none (informed by [002], [003])
- **Blocks:** none (informs fog graduation)

## Question

How do authentication, authorization, and identity work across Sanarwa — JWT/session/Better Auth mounting, API-key auth, tenant membership/roles, guards/decorators/middleware and tenant context, and how web and machine clients authenticate and are scoped — stated clearly enough to navigate and explain the security/identity model and reconcile doc drift? If understanding reveals concrete correctness/stability issues, scoped fixes, refactors, or migrations may be included.

## Resolution

# [008] Authn, authz, and identity in Sanarwa (medium research)

Research-only: no files modified. All claims grounded in files below.

## 1) Bootstrap, global enforcement, and request shape

### `apps/api/src/main.ts`

- Nest app created with `bodyParser: false` (L23-L43).
- Security/CORS/compression configured; **Better Auth is mounted first** at unversioned path: `app.use("/api/auth", betterAuthHandler)` (L64). This runs before `express.json`/`urlencoded`/`cookieParser` (L66-L80), which matches the comment that Better Auth parses its own bodies.
- Raw body preservation is enabled for webhook paths via `verify` (L67-L76), not for auth.
- Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) is applied (L82-L88).
- Global prefix is `API_PREFIX` excluding `UNVERSIONED_PATHS` (L90). So most controllers live under versioned API, but `/api/auth` is explicitly handled outside Nest routing by the Better Auth handler.
- Swagger is mounted only in non-production (L92-L96).

### `apps/api/src/app.module.ts`

- Global providers include:
- `APP_GUARD`: `ThrottlerGuard` then `AuthGuard` from `modules/auth/guards/jwt-auth.guard` (L166-L172).
- `APP_INTERCEPTOR`: metrics, async logging, audit log, global error, error alerting (L174-L192).
- `CorrelationIdMiddleware` applied to all routes (L195-L198).
- `AuthModule`, `ApiKeyModule`, `TenantModule`, `TenantMemberModule`, `OrganizationModule`, `UserModule`, etc. are all imported (L106-L136). `TenantModule.configure` also applies `TenantContextMiddleware` broadly but excludes `tenants`, `auth`, and root (see §4).
- Throttling is Redis-backed and skipped for non-HTTP contexts (L138-L158).

**Identity consequence:** every HTTP route is behind global `AuthGuard` unless marked `@Public()` (Reflector key `isPublic` from `modules/auth/decorators/public.decorator.ts`). Machine/API-key endpoints must opt into a different model explicitly (see §3, §6).

## 2) Session/JWT/Better Auth model (human auth)

### 2.1 Better Auth server instance — `apps/api/src/modules/auth/better-auth.ts`

- Builds a Better Auth instance with a **separate TypeORM DataSource** to `process.env.DATABASE_URL` (`betterAuthDataSource`, L11-L15) and `typeormAdapter(betterAuthDataSource)` (L136). It lazily initializes this DS via `ensureInitialized()` for direct SQL side effects (L30-L35).
- Core config: `secret` = `BETTER_AUTH_SECRET ?? JWT_AUTH_SECRET`; `baseURL` = `BETTER_AUTH_URL`; `basePath` `/api/auth`; `generateId: "uuid"` (L131-L141).
- Email/password enabled, **`requireEmailVerification: false`** (L172-L175). Password hashing/verify delegates to `argon2` (L175-L179). Reset-password email is currently logged to console and links to `${FRONTEND_URL}/reset-password?token=...` (L180-L186).
- Social providers conditionally registered for Google/GitHub from env vars (L188-L195); account linking enabled/trusted for them (L196-L201).
- Trusted origins aggregated from `CORS_ORIGIN`, `FRONTEND_URL`, `TRUSTED_ORIGINS` (L16-L23, L207).
- Plugins: `organization(...)` and `apiKey([...])` (L208-L325).
- Exports `auth`, `betterAuthHandler = toNodeHandler(auth)` and types (L328-L329).

### 2.2 Better Auth organization plugin and RBAC — `better-auth.ts` + `modules/auth/access.ts`

- Access control statement/roles are defined in `modules/auth/access.ts`:
- Resources: `organization`, `member`, `invitation`, `apiKey`.
- `owner`: full permissions on all; `admin`: org update (not delete), full member/invitation/apiKey; `member`/`viewer`: no permissions (L1-L37).
- Organization plugin uses this `ac/roles`, `creatorRole: "owner"`, membership/invitation settings, and console-logged invitation emails (L209-L223).
- **Tenant/org mirroring hooks** write into app tables to keep domain model in sync:
- `afterCreateOrganization` -> `mirrorTenantCreate` inserts `tenants` row (`id = org.id`, slug/subdomain, invite code, default quotas, `owner_id`) and `tenant_members` owner row if missing (L65-L89, L225-L235).
- Member add/accept/update -> `mirrorMemberUpsert` maps roles (`owner/admin/viewer` else `member`) and upserts `tenant_members` (L91-L129, L253-L282).
- `afterRemoveMember` marks `tenant_members.status='inactive'` (L283-L294).
- `afterDeleteOrganization` soft-suspends tenant and writes audit (L238-L251).
- `organization.schema.member.additionalFields` adds `name`, `avatar` (L297-L311).
- **Audit hooks**: `databaseHooks.user.create.after` and `session.create.after` call `writeAudit` inserting into `audit_logs` only when `tenantId` is present; session audit uses `session.activeOrganizationId` (L41-L63, L142-L171).
- **API-key plugin** (Better Auth side): config id `organization`, references organization, prefix `sa_`, metadata enabled, `rateLimit.enabled=false`, expiration allowed, `startingCharactersConfig.charactersLength=16` (L313-L324). This is a different storage/verification path than the Nest API-key entity/service in some respects (see §3.4).

### 2.3 Session authentication guard — `modules/auth/guards/jwt-auth.guard.ts`

- Class is named/exported as `AuthGuard` and registered globally in `AppModule`; despite filename `jwt-auth.guard.ts`, it does **not** verify a Nest/JWT token. It calls `auth.api.getSession({ headers: request.headers })` from Better Auth (L4, L25-L31).
- Honors `@Public()` metadata (L15-L22). Non-HTTP contexts are allowed through (L11-L13).
- On missing/invalid session throws `UnauthorizedException("Not authenticated")` (L33-L35).
- On success populates:
- `request.auth = { principalId: user.id, tokenType: "session", issuedAt, expiresAt, activeOrganizationId }` (L38-L48). `activeOrganizationId` comes from Better Auth session.
- `request.user = { id, sub: id, email, provider: "session" }` (L49-L54).
- This is the canonical “logged-in browser/user” identity for Nest endpoints protected by the global guard.

### 2.4 Custom auth module — `modules/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, strategies/entities

- `AuthModule` imports `JwtModule.registerAsync` with `secret: JWT_AUTH_SECRET`, `expiresIn: "24h"` and exports its own `AuthGuard` class (module L13-L28). It also applies `json()` middleware for `AuthController` routes (L30-L33).
- `AuthController` (`/auth`, under API prefix) exposes custom endpoints: register/login/profile/change-password/forgot-password/reset-password/refresh-token/get-session/logout (controller L25-L207). It uses `@Public()` on unauthenticated flows and `@UseGuards(AuthGuard)` on profile/change-password/logout; also sets/clears `accessToken`/`refreshToken` HTTP-only cookies (L209-L232).
- `AuthService` is a **separate credential/session system**:
- Stores users in `users` and credentials in `accounts` (`providerId="credential"`), hashes with argon2 (service L38-L113, L203-L227).
- On register emits `user.registered` and expects a tenant result; returns tenant info plus JWTs (L89-L112).
- Login verifies against account/user password, creates a DB `Session` row with random token and 7-day expiry, returns signed JWTs (L115-L172).
- Issues access/refresh JWTs via `JwtService` (`JWT_AUTH_SECRET`/`JWT_REFRESH_SECRET`, configurable expiries) (L318-L338).
- `refreshToken` verifies JWT refresh token and reissues tokens (L247-L265). `getSession` verifies access JWT (not Better Auth session cookie) (L297-L316). `logout` deletes all DB sessions for user (L267-L270). `forgotPassword` is non-enumerating stub; `resetPassword` always throws invalid/expired (L230-L245).
- OAuth callback helper upserts user by email and returns JWTs (L174-L200), but see controller/strategy wiring below.
- `oauth.controller.ts` is `@Public()` and wires `OAuthGuard` from `./guards/google-auth.guard` for `GET /oauth/:provider` and callback; callback redirects to frontend with tokens in query string (L1-L34). This is a token-in-URL flow, different from Better Auth’s cookie/session flow.
- Strategies present: `api-key.strategy.ts` is a Passport custom strategy that validates to `{}` (placeholder, unused in observed Nest guards) (L1-L14). `google.strategy.ts`/`github.strategy.ts` files exist (glob) but were not read in detail.
- `CurrentUser` decorator (`modules/auth/decorators/current-user.decorator.ts`) returns the **entire request object**, not `request.user` (L3-L5). `@CurrentApiKey` returns `request.apiKey` typed as machine key context (L12-L15).

**Notable drift/correctness observation:** the codebase contains two parallel auth stacks: Better Auth (mounted at `/api/auth`, cookie/session-based, `activeOrganizationId`, org/api-key plugins, global guard uses it) and a custom JWT/cookie/DB-session auth (`AuthController`/`AuthService`, `JWT_*` secrets, emits tenant creation). They share user/account/session concepts but are not obviously unified; behavior depends on which route/client path is used.

## 3) API-key (machine) authentication and scoping

There are two API-key guard implementations with overlapping behavior but important differences.

### 3.1 `modules/api-key/guards/api-key-auth.guard.ts` (richer, module-exported)

- Extracts key from `Authorization: Bearer...` or `x-api-key` only (L77-L88). Validates via `ApiKeyService.validateApiKey(key, undefined, ipAddress)` (L34).
- Rejects missing/invalid/expired/revoked keys (L28-L46), enforces optional IP whitelist if configured (L48-L52).
- Enforces per-key Redis rate limits for minute/hour/day using `INCR`+`EXPIRE` Lua eval; requires Redis available and finite positive configured limits (L94-L127). Throws `ServiceUnavailableException` if Redis missing for rate-limit check (L105-L107).
- Optionally checks tenant token quota via `TokenManagementService` if `tenantId` present (L129-L152); warns on low balance, forbids on zero.
- Enforces coarse route/method permission map (e.g. `POST /notifications -> notifications:send`, `GET /templates -> templates:read`, webhooks manage/read) and supports wildcard `*` (L154-L192).
- Attaches `request.apiKey = { id, keyPrefix, projectId, tenantId, permissions, environment }` (L65-L72).

### 3.2 `modules/auth/guards/api-key-auth.guard.ts` (simpler/older-looking)

- Similar extraction but also accepts `query.api_key` (auth/guards/api-key-auth.guard.ts L73-L88).
- IP detection differs (uses forwarded/real-ip heuristics; module guard uses `request.ip/socket`).
- `checkRateLimits` does **not** enforce; it only throws “not configured” if limits missing and otherwise no-ops (L101-L105). No Redis usage.
- Token quota check swallows non-forbidden errors as `BadRequestException("Failed to check token quota")` (L107-L130).
- Permission map differs slightly (e.g. `POST /messages -> messages:send`, `GET /messages -> messages:read` vs module guard maps messages to notifications permissions) (L132-L157).
- Attaches the same `request.apiKey` shape on success.

**Correctness/stability observation:** duplicate `ApiKeyAuthGuard` classes in different modules can lead to inconsistent enforcement depending on import path. The `ApiKeyModule` exports `./guards/api-key-auth.guard` (Redis/token-quota/rate-limit aware) and controllers that need machine auth must choose deliberately.

### 3.3 API-key management API — `modules/api-key/api-key.controller.ts`

- Route: `tenants/:tenantId/projects/:projectId/api-keys`, guarded by `@UseGuards(AuthGuard, TenantMemberGuard)` where `AuthGuard` is Better Auth session guard (`modules/auth/guards/jwt-auth.guard`) (L30-L36). This is a human/session-managed admin surface, not machine-key-authenticated.
- Uses `@CurrentMemberId()` as creator id (L75-L81); create returns full key material via service on creation.

### 3.4 API-key domain/service — `modules/api-key/api-key.service.ts`, entities

- Service uses Better Auth’s API-key plugin for verification and lifecycle: `auth.api.verifyApiKey({ body: { key, configId: "organization" } })`, `createApiKey`, `updateApiKey`, `deleteApiKey` (L9, L103-L108, L158-L171, L236-L248, L277).
- Validation treats `referenceId` as `tenantId` and reads operational metadata from key metadata (`projectId`, environment, ipWhitelist, rate limits) (L110-L131). Permission parsing supports JSON array/object or comma string (L51-L70).
- Creation requires non-`__system__` creator, enforces unique name per tenant/reference, stores project/rate-limit/IP/env/creator in metadata, and passes permissions as `resource -> actions[]` record to Better Auth (L133-L197).
- Listing/update are scoped to `tenantId` (`referenceId`) and filtered by `metadata.projectId` in app logic (L199-L226, L228-L272). Revocation deletes via Better Auth after tenant check (L274-L278).
- Persistence read/write uses `BetterAuthApiKey` repository entity (L99-L101, L172-L176, L199-L201 etc.).
- `ApiKey` entity (`modules/api-key/entities/api-key.entity.ts`) still exists with hash/prefix/project/tenant relations and status helpers, but service paths shown operate on Better Auth-backed `BetterAuthApiKey` rows/metadata.

**Scoping note:** machine key validation binds to `tenantId = referenceId` (organization) and `projectId` from metadata; guards attach these to `request.apiKey`. Route-level required permissions are inferred from path/method in guards, not from decorators in the read files.

## 4) Tenant, membership, organization, and request scoping

### 4.1 Data model split and mirroring

- Better Auth org/member/invitation entities exist under `modules/organization/entities/*` (e.g. `member.entity.ts`: table `member`, `organizationId`, `userId`, `role`, `name`, `avatar`, unique `[organizationId,userId]`). These are the plugin’s tables.
- App tenancy model uses `tenant_members` (`modules/tenant-member/entities/tenant-member.entity.ts`) with `TenantMemberRole/Status`, tenant/user relations, and many ownership relations; unique `[tenantId,userId]` (L16-L52).
- `better-auth.ts` mirrors org lifecycle into `tenants`/`tenant_members` via raw SQL hooks (see §2.2), effectively making Better Auth organization identity and tenant identity converge on the same IDs in mirrored flows.

### 4.2 Tenant/member services and events

- `TenantMemberService` provides CRUD/query/mapping and lookups (`getMemberByUserId`, `findByUserEmail`, paginated member/user-tenant views) (`modules/tenant-member/tenant-member.service.ts` L29-L301). It listens to `tenant.created` to create an `OWNER` membership (L262-L276) and emits `tenant.member.created` for non-owner creates (L39-L44).
- DTO/entities and role enums come from common/domain modules (`common/enums`).

### 4.3 Guards and decorators for tenant authorization

- **`common/guards/tenant-member.guard.ts`** is the main membership gate:
- Requires authenticated principal (`request.user.id` or `request.auth.principalId`) (L27-L31).
- Resolves `tenantId` from route param `tenantId`, header `x-tenant-id`, or `request.auth.activeOrganizationId` (Better Auth active org) (L32-L38).
- Validates UUID format (L40-L44).
- If `OrganizationService` is injected/available, tries `getMembership(tenantId, userId)` first and maps Better Auth org role -> `TenantMemberRole` (`owner/admin/viewer` else member), then sets `request.member` and allows (L47-L58, L87-L92).
- Falls back to `TenantMemberService.getMemberByUserId`; if none, forbids (L60-L78).
- On unexpected errors throws generic “Failed to verify tenant membership” (L78-L83).
- Dependencies are `@Optional()`, so behavior degrades if services are not available in module context.
- **`common/decorators/current-member.decorator.ts`**: `@CurrentMember/@CurrentMemberId/@CurrentTenantId` read from `request.member` and throw if `TenantMemberGuard` not applied (L4-L41). There is also `common/decorators/current-context.decorator.ts` and `index.ts` exporting similarly named decorators backed by `ContextService` (seen in grep) — another potential ambiguity by import source.
- **`common/interfaces/request-context.interface.ts`** defines `AuthContext`, `MemberContext`, `AsyncMemberContext`, and `AuthenticatedRequest { auth, member?, user? }` (L3-L41).
- **`modules/tenant/decorators/current-tenant.decorator.ts`** reads `request.tenant`/`request.tenantId` (L4-L16), but:
- **`modules/tenant/middleware/tenant-context.middleware.ts`** is a no-op `next()` and only augments Express typings (L1-L21).
- **`modules/tenant/tenant.module.ts`** applies this middleware to most routes while excluding tenant/auth/root paths (L19-L31).
- **`modules/tenant/guards/tenant-auth.guard.ts`** always rejects with `UnauthorizedException("Tenant-level API authentication is not supported. Use project-level API keys instead.")` (L1-L12).

**Observation:** tenant request context (`request.tenant`) is not populated by the middleware shown; membership context is populated by `TenantMemberGuard`. Active tenant selection for session users leans on Better Auth `activeOrganizationId` (surfaced in `request.auth`) and header/param resolution in guards.

## 5) Web and machine client integration

### 5.1 Web (browser) — Better Auth client

- `apps/web/src/lib/better-auth-client.ts` creates a Better Auth client with `organizationClient` plugin and mirrors access-control roles (owner/admin/member/viewer) client-side (L3-L64). Base URL defaults to `http://localhost:3000/api/auth` or `${VITE_API_URL}/api/auth` (L38-L45). Exports `authClient`, `useBetterAuthClient`.
- `apps/web/src/contexts/auth-context.tsx` wraps `authClient.useSession()` as app auth state and implements login/register/logout/refresh via `authClient.signIn.email`, `signUp.email`, `signOut`, `getSession` (L42-L112). It sets local error state but does not manage custom JWT cookies/tokens.
- `apps/web/src/lib/session.ts` provides helpers around Better Auth session/org APIs: `fetchSession`, `requireSession` (redirects to `/login` with `search.redirect`), `fetchOrganizations`, `fetchActiveOrganization`, `fetchActiveMember` (L1-L29).
- `apps/web/src/routes/auth.tsx` immediately redirects `/auth` to `/login` (L1-L7), consistent with auth UI living on dedicated routes while server auth endpoints are `/api/auth` (Better Auth) and/or Nest auth controller routes.
- Search showed `apps/web/src/routes/accept-invitation.$invitationId.tsx` and OAuth callback routes/assets exist and reference `authClient`/better-auth flows (from grep results), but I did not read them fully.

### 5.2 Machine clients

- Intended machine auth path is API keys presented as `Authorization: Bearer <sa_...>` or `x-api-key`, validated through Better Auth verify + Nest guards/services that attach `request.apiKey` with `{tenantId, projectId, permissions, environment,...}` (§3).
- Because global guard is session-based `AuthGuard` (`jwt-auth.guard.ts` class), endpoints meant for API keys must be explicitly public/bypassed or use a compatible guard composition; this is not defined in a single place and depends on per-controller setup.

## 6) Doc drift and notable issues (from observed code)

- **`CONTEXT.md` drift is real but nuanced:** Better Auth is mounted and depended on (`main.ts` L19/L64, `better-auth.ts`, deps/modules present). However, the repo also retains a substantial custom JWT/credential auth controller/service and cookie issuance path (`modules/auth/auth.controller.ts`, `auth.service.ts`, `JwtModule`), so “Better Auth is the auth system” is only partially true.
- **Naming/behavior mismatch:** global/session guard file is `modules/auth/guards/jwt-auth.guard.ts` but implements Better Auth session resolution (`auth.api.getSession`) and sets `tokenType: "session"`.
- **Parallel/duplicate API-key guards:** `modules/auth/guards/api-key-auth.guard.ts` vs `modules/api-key/guards/api-key-auth.guard.ts` differ in extraction, rate limiting, Redis dependency, token-quota failure handling, and permission maps; wrong import yields weaker or broken enforcement.
- **Tenant context middleware is inert:** `TenantContextMiddleware.use` only calls `next()`; `CurrentTenant` expects `request.tenant/tenantId` to be pre-populated, so tenant-object decoration likely does not work without other code not seen here.
- **`CurrentUser` decorator contract:** returns full request, not user payload (`modules/auth/decorators/current-user.decorator.ts`), which can surprise handlers expecting `req.user`.
- **OAuth token delivery risk pattern:** custom `OAuthController` redirects with `accessToken`/`refreshToken` in query params (`oauth.controller.ts` L31-L32), unlike Better Auth cookie/session flow.
- **Auth/session data duplication:** Better Auth uses its own adapter/DS and hooks mirror into app tables (`tenants`, `tenant_members`, audit logs), while custom auth also writes `users/accounts/sessions` and emits domain events; consistency depends on which flow creates/mutates state.
- **Guard dependency softness:** `TenantMemberGuard` accepts optional services and can behave differently/fail-open in structure if miswired (though current code returns true only in a specific fallback path when `tenantMemberService` missing after org lookup miss? it returns `true` at L61 only if no tenantMemberService; worth careful review at call sites).

## 7) Practical navigation map

- **Server bootstrap/auth mount:** `apps/api/src/main.ts` (Better Auth handler before body parser), `apps/api/src/app.module.ts` (global `AuthGuard`/throttler/interceptors, module wiring).
- **Better Auth core:** `apps/api/src/modules/auth/better-auth.ts`, `apps/api/src/modules/auth/access.ts`.
- **Session guard (global):** `apps/api/src/modules/auth/guards/jwt-auth.guard.ts`, `modules/auth/decorators/public.decorator.ts`.
- **Custom/ credential API:** `apps/api/src/modules/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `oauth.controller.ts`, `strategies/*`, `entities/*`, DTOs.
- **Machine keys:** `apps/api/src/modules/api-key/{api-key.module,api-key.service,api-key.controller,entities/*,guards/api-key-auth.guard.ts}` and duplicate `apps/api/src/modules/auth/guards/api-key-auth.guard.ts`.
- **Tenant/membership/org:** `apps/api/src/modules/tenant/{tenant.module,middleware/tenant-context.middleware.ts,guards/tenant-auth.guard.ts,decorators/current-tenant.decorator.ts}`, `apps/api/src/modules/tenant-member/{tenant-member.service.ts,entities/tenant-member.entity.ts,...}`, `apps/api/src/modules/organization/entities/member.entity.ts`.
- **Cross-cutting authorization context:** `apps/api/src/common/guards/tenant-member.guard.ts`, `common/interfaces/request-context.interface.ts`, `common/decorators/current-member.decorator.ts` (and similarly named context decorators in common).
- **Web client/session:** `apps/web/src/lib/better-auth-client.ts`, `apps/web/src/lib/session.ts`, `apps/web/src/contexts/auth-context.tsx`, `apps/web/src/routes/auth.tsx`.

This model is best understood as: **Better Auth session + organization plugins for human/browser auth and active-tenant context, mirrored into app tenant/member tables**, with **Better Auth-backed project/org API keys for machines** (when guarded appropriately), alongside a ** Nest JWT credential flow** that still exists in code and can diverge.
