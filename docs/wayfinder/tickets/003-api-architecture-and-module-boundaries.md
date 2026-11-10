# [003] API architecture and module boundaries

- **Label:** `wayfinder:research`
- **Status:** closed (resolved)
- **Parent map:** [Whole-repo understanding map](../MAP-001-whole-repo-understanding.md)
- **Blocked by:** none
- **Blocks:** none (informs fog graduation)

## Question

How is `apps/api` (NestJS) structured — its module map, layering/cross-cutting concerns (auth/guards, config, database, queues, common utilities), request/transport surfaces, and the boundaries/responsibilities of major domains (messaging/notifications, campaigns, workflows, preferences/inbox, providers, tenants/projects/keys, billing/tokens, etc.) — stated clearly enough to navigate and explain the backend’s architecture?

## Resolution

# Sanarwa `apps/api` architecture (`/home/daniel/Documents/projects/sanarwa/apps/api`)

## 1) Bootstrap, runtime wiring, and HTTP surface

**Entry/bootstrap**: `apps/api/src/main.ts`

- Creates `NestExpressApplication` from `AppModule` with `bufferLogs: true`, `bodyParser: false`, custom Nest log levels, and `nestjs-pino` logger (`Logger` from `nestjs-pino`).
- Startup sequence: load `ConfigService`, run `EnvironmentValidationService.validateOrThrow()`, set `trust proxy` from `TRUST_PROXY`, configure security middleware/CORS, enable compression, mount Better Auth, mount JSON/urlencoded parsers + cookie parser, install global `ValidationPipe`, set global prefix, expose Swagger in non-production, then listen on `app.port` (default `3000`).
- **Better Auth mounted before body parsing**: `app.use("/api/auth", betterAuthHandler)` (`modules/auth/better-auth.ts`) because Better Auth parses its own request bodies.
- **Body parsing with raw-body capture for webhooks**: `express.json({ limit: "1mb", verify(...) })` stores `req.rawBody` when `req.originalUrl` includes `/billing/webhooks/` or `/webhooks/` (signature verification support), plus `express.urlencoded({ extended: true, limit: "1mb" })` and `cookieParser()`.
- **Global validation**: `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- **Global route prefix**: `app.setGlobalPrefix(API_PREFIX, { exclude: UNVERSIONED_PATHS })`.
- `common/http/api-prefix.ts`: `API_PREFIX = "api/v1"`; unversioned exclusions: `GET /`, `GET /metrics`, `GET /docs`, `ALL /mcp`.
- **Docs**: Swagger is generated from `createSwaggerConfig()` (`config/swagger.config.ts`) and served at `/docs` only when `NODE_ENV !== "production"`.

**Root module composition**: `apps/api/src/app.module.ts`

- `AppController` `AppService` at root.
- `configure(consumer)`: applies `CorrelationIdMiddleware` (`common/logging/correlation-id.middleware`) to `*path`.
- **Global providers (cross-cutting by default)**:
- Guards: `APP_GUARD -> ThrottlerGuard`, `APP_GUARD -> AuthGuard` (`modules/auth/guards/jwt-auth.guard.ts`).
- Interceptors (registered in order): `MetricsInterceptor`, `AsyncLoggingInterceptor`, `AuditLogInterceptor`, `GlobalErrorInterceptor`, `ErrorAlertingInterceptor`.
- `EnvironmentValidationService`, `PasswordService`.

## 2) Configuration, environment, and infrastructure wiring

**Config loading** (`app.module.ts`, `config/`)

- `ConfigModule.forRoot({ isGlobal: true, load: [appConfig, redisConfig, queueConfig, jwtConfig, loggingConfig], validate, envFilePath: [".env.local", ".env"] })`.
- `config/index.ts` exports `appConfig`, `databaseConfig` (present but not in root `load` array), `validate` (`environment.validator`), `jwtConfig`, `queueConfig`/`redisConfig`.
- `config/app.config.ts` namespace `app`: `nodeEnv`, `port`, `apiPrefix`, `logLevel`.
- Other config namespaces/files present: `database.config.ts`, `jwt.config.ts`, `logging.config.ts`, `redis.config.ts`, `swagger.config.ts`, `environment.validator.ts`.

**Persistence data access**

- **Primary DB**: `TypeOrmModule.forRoot(dataSourceOptions)` with options from `common/database/data-source.ts`.
- PostgreSQL via `DATABASE_URL`, `synchronize: false`, `migrationsRun: true`, `migrationsTransactionMode: "all"`, `SnakeNamingStrategy`, dev logging.
- Centralized entity and migration registry (users/tenants/org/auth, projects/brands/templates/api keys, messaging/notifications/deliveries/logs, providers/devices/push certs/usage, billing/subscription/tokens/webhook events, WhatsApp ESU/WABA, workflows/runs, quotas, etc.).
- **Queues**: `BullModule.forRootAsync` uses `queue.redis` config connection (fallback `localhost:6379`).
- **Redis (app/cache/pubsub use)**: `RedisModule.forRootAsync` (`@nestjs-modules/ioredis`) with `redis.url`, `maxRetriesPerRequest: 3`.
- **Rate limiting storage**: `ThrottlerModule.forRootAsync` creates a dedicated `ioredis` client from `redis.url`, wraps it in `RedisThrottlerStorage`, skips non-HTTP contexts (`skipIf`), and applies global throttler from `RATE_LIMIT_WINDOW`/`DEFAULT_RATE_LIMIT`.

**Cross-cutting framework modules in root**

- `EventEmitterModule.forRoot()`, `ScheduleModule.forRoot()` also appears in several feature modules (billing, campaign, workflow, notifications, etc.), `LoggingModule`, `AuditLogModule`, `SecurityModule`, `ErrorsModule`, `ErrorHandlingModule`, `MonitoringModule`.

## 3) Cross-cutting concerns and shared layers

### 3.1 `apps/api/src/common/` (platform/shared layer)

Directories: `cache`, `config`, `database`, `decorators`, `dto`, `enums`, `errors`, `events`, `guards`, `helpers`, `http`, `interceptors`, `interfaces`, `logging`, `middleware`, `monitoring`, `rate-limiting`, `scalability`, `security`, `services`, `throttler`, `utils`.

Key observed pieces:

- `common/http/api-prefix.ts`: versioned API prefix and unversioned route exclusions.
- `common/database/data-source.ts`: TypeORM datasource/entities/migrations.
- `common/logging/correlation-id.middleware.ts` + `common/logging/` (+ `AsyncLoggingInterceptor`) for request correlation/logging.
- `common/throttler/redis-throttler-storage.ts` for distributed throttling.
- `common/interceptors/global-error.interceptor.ts`, `common/errors/`, `common/errors/error-handling.module.ts` for centralized error handling/types.
- `common/monitoring/interceptors/metrics.interceptor.ts`, `error-alerting.interceptor.ts`, `monitoring.module`.
- `common/security/audit-log.module.ts`, `common/security/interceptors/audit-log.interceptor.ts`, `common/security/security.module`, `common/security/utils/safe-url` (used by notification engine for webhook URL validation).
- `common/helpers/password.service.ts`.
- `common/guards` (e.g. `TenantContextGuard` used in billing module) and tenant-aware middleware in `modules/tenant/middleware/tenant-context.middleware.ts`.
- `common/enums/notification-channel.enum.ts`, `common/utils/assert-never.ts` used by delivery/engine code.

### 3.2 AuthN/AuthZ and request identity

- **Default API guard**: `modules/auth/guards/jwt-auth.guard.ts` (`AuthGuard`, global `APP_GUARD`) uses `Reflector` + `@Public()` metadata; skips non-HTTP and public routes. For protected HTTP routes it resolves session via Better Auth (`auth.api.getSession({ headers: request.headers })`) and populates:
- `request.auth = { principalId, tokenType: "session", issuedAt, expiresAt, activeOrganizationId }`
- `request.user = { id, sub, email, provider: "session" }`
- **Better Auth core**: `modules/auth/better-auth.ts`
- `betterAuth(...)` with Postgres TypeORM adapter (`@hedystia/better-auth-typeorm`), `basePath "/api/auth"`, argon2 password hashing/verify, optional Google/GitHub social providers, account linking, verification fields mapping.
- Plugins: `organization` (access control/roles, hooks mirror org/member lifecycle into `tenants`/`tenant_members`, audit writes) and `apiKey` (`configId: "organization"`, `defaultPrefix: "sa_"`, metadata enabled, rate limit disabled, UUID generation).
- Exposes `betterAuthHandler = toNodeHandler(auth)` mounted in `main.ts`; also DB/audit/tenant-mirror side effects on auth events.
- **API-key auth path**: `modules/api-key/api-key.module.ts` provides `ApiKeyService`/`ApiKeyAuthGuard` (guard file present: `modules/auth/guards/api-key-auth.guard.ts`; controller/service/entities in `modules/api-key`). API-key module depends on tenant/member/token-management/organization modules and stores `ApiKey` + `BetterAuthApiKey` entities.
- **Auth module**: `modules/auth/auth.module.ts` imports JWT config (`JWT_AUTH_SECRET`), TypeORM entities (`User`, `Session`, `Account`, `Verification`), event emitter; exports `AuthGuard`; applies JSON middleware to `AuthController`.
- **Tenant context**: `TenantModule.configure` applies `TenantContextMiddleware` for `*path` except tenant/auth/root routes (`modules/tenant/tenant.module.ts`), and billing uses `TenantContextGuard` (`common/guards`).

## 4) Module map and domain boundaries

### 4.1 Identity, tenancy, access, and org/project boundaries

- **`AuthModule`** (`modules/auth`): session/credential/social auth integration, Better Auth handler integration, auth controller/service/entities (`session`, `account`, `verification`, etc.), guards/decorators.
- **`UserModule`** (`modules/user`): user entity/repository/service/controller/DTOs/tests.
- **`OrganizationModule`** (`modules/organization`): Better Auth organization mirror entities (`organization`, `member`, `invitation`) and service.
- **`TenantModule`** (`modules/tenant`): tenant aggregate/controller/service/repository, quota controller, tenant settings/billing-info entities, tenant-context middleware application.
- **`TenantMemberModule`** (`modules/tenant-member`): tenant membership boundary (consumed broadly for authorization/ownership checks).
- **`InviteModule`** (`modules/invite`): invitation flows/entities.
- **`ProjectModule`** (`modules/project`): project entity/controller/service/repository + `ProjectApiController`; depends on auth, tenant, tenant-member, provider, token-management.
- **`ApiKeyModule`** (`modules/api-key`): API key management and API-key authentication (`ApiKey`, `BetterAuthApiKey`).
- **`BrandModule`** (`modules/brand`): brand/messaging branding config (used by provider orchestration/push/email enhancement).
- **`SecurityModule`** (`common/security/security.module`), **`AuditLogModule`** (`common/security/audit-log.module.ts`): platform security/audit capabilities.

### 4.2 Messaging, notifications, delivery, and inbox surfaces

- **`MessagingModule`** (`modules/messaging`)
- Imports: messaging entities module, `NotificationLog`, Bull queue (`NOTIFICATION_ADMIN_QUEUE`), notification queue module, messaging services, template, tenant, provider, notifications, auth, api-key.
- Controllers: `MessagingController`, `MessagesController`, `NotificationController`.
- Core services/repositories: `MessagingService`, `NotificationService`, `MessageRepository`, `MessageDeliveryRepository`, `DeadLetterRepository`, `DeadLetterProcessor`, `AuthEmailService`; exports messaging service/repositories/services module.
- Owns message/delivery/dead-letter persistence and send orchestration integration points (with queue/providers/notifications).

- **`NotificationsModule`** (`modules/notifications`)
- Imports: TypeORM (`NotificationLog`, `InAppNotification`, `TenantSettings`, `DeviceRegistration`), messaging entities/queue/idempotency, JWT, schedule, provider, api-key, tenant-member, preferences, topics, quotas.
- Controllers: `NotificationTransportController`, `EmailInboundController`, `NotificationCenterController`, `PublicPushController`.
- Providers/services: `NotificationTransportService`, `NotificationCenterService` (+ types), `NotificationGateway`, `NotificationStorageService`, `NotificationEngineService`, `UnifiedSendService` (`messaging/unified-send.service`), `WebPushSubscriptionService`.
- Exports unified send, transport, notification center/gateway, storage, engine.
- **Notification engine** (`notifications/engine/notification-engine.service.ts`): central immediate/scheduled send path.
- Generates tracking IDs, resolves storage policy, enforces consent (`ConsentService`) and quiet-hours rescheduling, checks project quota for immediate sends, persists send context/log/message/delivery via `NotificationStorageService`.
- Dispatches by channel to email/SMS/push/WhatsApp/chat/webhook/in-app/voice through `ProviderOrchestratorService` (and smart push routing/topic fan-out/device handling).
- Handles scheduling by creating/persisting pending `Message` and enqueueing via `NotificationQueueService`; updates outcomes/finalizes ephemeral storage.
- **Unified send facade** (`messaging/unified-send.service.ts`): validates/normalizes multi-channel requests and recipients, resolves per-channel addresses, supports fallback chains, idempotency claim/complete/abandon, storage policy-aware persistence, creates `Message` + `MessageDelivery` rows, enqueues notification jobs.

- **`InAppModule`** (`modules/in-app`): in-app inbox/feed/gateway boundary (`InAppInboxController`, `InAppGateway`, `InAppFeedService`, `InAppNotification` entity).
- **`PreferencesModule`** (`modules/preferences`): consent, quiet-hours, suppressions/preferences, subscriber erasure; controller/services over preference/suppression/quiet-hours and related messaging/notification entities.
- **`TopicsModule`** (`modules/topics`): topic/subscription management and subscriber resolution APIs/services (used by push/topic fan-out and campaigns/preferences).
- **`ChannelsModule`** (`modules/channels`): channel configuration/discovery surface over projects/providers/tenant membership (`ChannelsController`, `ChannelsService`).

### 4.3 Provider integration and transport adapters

- **`ProviderModule`** (`modules/provider`) is the external delivery/provider boundary and one of the largest modules.
- Imports: provider config/usage/device/notification-log entities, config, security, event emitter, auth/tenant-member, channel submodules (`EmailModule`, `ChatModule`, `PushModule`, `SMSModule`, `InAppModule`, `VoiceModule`), API key/billing/brand/delivery-events/errors modules.
- Controllers: `ProviderConfigController`, `BYOPController`, `DeviceRegistrationController`, `TelnyxWebhookController`, `WhatsAppWebhookController`, `EmailWebhookController`, `RoutingOptimizerController`.
- Core providers/services: `ProviderService`, `ProviderConfigRepository`, `ProviderConfigValidator`, `ProviderEncryptionService`, `ProviderFactory`, `ProviderPerformanceTracker`, `ProviderTemplateService`, `ProviderCostTrackerService`, `RoutingOptimizerService`, `ProviderOrchestratorService`, device/webhook/smart-routing/branded-push/SNS verification services.
- **Registration/orchestration**: `PROVIDER_REGISTRATIONS` factory wires concrete adapters into `ProviderFactory` and managed/BYOP registries in `ProviderOrchestratorService` for email/chat/push/SMS (and /factory registrations like SES/SNS/Pinpoint/Meta WhatsApp/Termii/Asia SMS). Distinguishes managed chains vs BYOP-only providers (e.g. SES/SNS BYOP-only comments; chat/WhatsApp treated as BYOP-only in orchestrator logic).
- **ProviderOrchestratorService** (`provider/provider-orchestrator.service.ts`) responsibilities:
- Resolve BYOP vs managed provider per channel/tenant, decrypt BYOP configs, validate configs, create per-send provider instances via factories when needed.
- Execute sends behind circuit breakers (`CircuitBreakerService`), classify retryable vs permanent failures, prune invalid push tokens, and attempt managed fallback chains (email/push/SMS) or single-provider BYOP sends.
- Channel methods: `sendEmail`, `sendChatMessage`, `testChatConnection` (BYOP probe, no billing/circuit-breaker path noted in code), `sendPushNotification`, `sendSMS`, `sendBulkSMS`, `sendVoiceCall`, `sendInAppNotification`, `sendToRoom`, `sendCallNotification`.
- Post-send token billing via `BillingIntegrationService.processNotificationTokenUsage(...)`; brand enhancement hooks for email/push.
- Exposes provider availability/status helpers and phone validation.
- **`WhatsAppModule`** (`modules/whatsapp`): WhatsApp Business/embedded-signup/message/media/conversation/advanced services and controllers; persists WABA/tenant WABA entities and message/delivery records.
- **`PushCertificatesModule`** (`modules/push-certificates`): push certificate/cert management boundary (entity registered in datasource).
- **`WebhookModule`** (`modules/webhook`): tenant-managed webhook endpoint CRUD/storage (`Webhook` entity/controller/service).

### 4.4 Campaigns, workflows, templates, analytics, quotas

- **`CampaignModule`** (`modules/campaign`): campaign CRUD/scheduling/execution boundary over `Campaign` entity; depends on auth, tenant-member, topics, notifications (+ schedule/event emitter).
- **`WorkflowModule`** (`modules/workflow`): workflow definitions/runs (`Workflow`, `WorkflowRun`) with controller/service; depends on notifications for delivery actions.
- **`TemplateModule`** (`modules/template`, exported via `modules/template/index.ts`): notification/template management (`Template` entity/service/module).
- **`AnalyticsModule`** (`modules/analytics`): analytics/reporting domain (registered in app; implementation under module dir).
- **`QuotasModule`** (`modules/quotas`): project send quota enforcement APIs/services (`ProjectQuotaController`, `ProjectQuotaService`, `ProjectSendQuota` entity) used by notifications engine and project flows.

### 4.5 Billing, subscriptions, tokens, compliance

- **`BillingModule`** (`modules/billing`)
- Imports billing/subscription/token/payment/webhook-event/tenant entities, config, schedule, auth, tenant-member.
- Controller: `BillingController`.
- Services: `BillingService`, `TokenPurchaseService`, `CheckoutProviderService`, `AutoTopupService`, `BillingWebhooksService`, `BachsService`, `PaymentMethodService`, `TokenManagementService` (from token-management module), `BillingIntegrationService`, `WelcomeTokenListener`, `TenantContextGuard`.
- Exports billing, purchase/checkout, auto-topup, webhook handling, token management/integration, payment helpers.
- `common/database/data-source.ts` also registers token/purchase/balance/transaction/subscription/payment-method/webhook-event entities and billing migrations.
- **`ComplianceModule`** (`modules/compliance`): compliance controller/service/module (policy/compliance operations boundary).
- **`ConfigurationModule`** (`modules/configuration`): configuration domain/services including `EnvironmentValidationService` used at bootstrap.

### 4.6 AI/tooling and MCP

- **`SanarwaMcpModule`** (`modules/mcp/mcp.module.ts`)
- Imports `ApiKeyModule`, `AnalyticsModule`, `MessagingModule`, `TokenManagementModule` and registers `McpModule.forRootAsync` at path `mcp` with `@Public()` decorator.
- Uses `ApiKeyTokenVerifier` backed by `ApiKeyService`/config, exposes MCP resource/auth metadata and supported scopes (`MCP_SCOPES`), registers `SanarwaMcpTools`.
- MCP endpoint is also excluded from global API prefix (`UNVERSIONED_PATHS` includes `/mcp`).

## 5) Request/transport surfaces (observed)

- **Versioned REST API**: most controllers live under `api/v1` (global prefix), organized by domain modules (`auth`, `users`, `tenants`, `projects`, `api-keys`, `providers/channels/topics`, `messaging/messages/notifications`, `campaigns`, `workflows`, `preferences`, `billing`, `webhooks`, `whatsapp`, `quotas`, etc. — inferred from module/controller layout).
- **Unversioned/system endpoints**: `/` and `/metrics` (root, `RequestMethod.GET`), `/docs` (Swagger, non-prod), `/mcp` (`RequestMethod.ALL`, public MCP transport).
- **Better Auth HTTP surface**: `/api/auth/*` handled by `betterAuthHandler` before Nest body parsing/global API prefix concerns.
- **Webhooks/inbound transports** (controller/module locations): billing webhooks (`modules/billing/...` + `BillingController`/`BillingWebhooksService`), provider/integration webhooks (`modules/provider/controllers/telnyx-webhook.controller.ts`, `whatsapp-webhook.controller.ts`, `email-webhook.controller.ts`), email inbound transport (`modules/notifications/transport/inbound-email/email-inbound.controller.ts`), tenant webhooks storage/delivery config domain (`modules/webhook`).
- **Notification transport/public endpoints**: `NotificationTransportController`, `PublicPushController`, `NotificationCenterController`.
- **Realtime/in-app gateway**: `InAppGateway` and `NotificationGateway` (socket/gateway-style providers in in-app/notifications modules).

## 6) Key backend flows and boundaries (code-grounded)

- **Ingress/auth boundary**: global `ThrottlerGuard` + Better Auth session `AuthGuard` by default; public exceptions via `@Public()` and MCP public registration; API-key flows exist in `api-key`/guard modules. Better Auth also mirrors organization/member lifecycle into tenant/member tables and writes audit records.
- **Tenant/project scoping**: tenant context middleware on most routes (excluding tenant/auth/root), tenant-member checks in many modules, quotas/billing tied to tenant/project.
- **Notification sending paths**:
- `UnifiedSendService` (notifications module export, messaging implementation) normalizes channel/recipient/fallback/idempotency, persists message+deliveries, enqueues jobs for async processing.
- `NotificationEngineService` handles direct/immediate or scheduled sends with consent/quiet-hours/quota checks, storage-policy-aware persistence, per-channel dispatch via provider orchestrator, and outcome tracking.
- **Delivery/provider boundary**: `ProviderOrchestratorService` centralizes BYOP-vs-managed resolution, provider instantiation/factories, circuit-broken execution, managed fallback chains, branding enrichment, voice/in-app special handling, and billing charging on successful sends.
- **Async processing**: BullMQ infrastructure configured globally; messaging/notifications modules register/use queues/processors (`NOTIFICATION_ADMIN_QUEUE`, dead-letter processor, notification queue/idempotency modules) for scheduled and queued delivery.
- **Persistence/audit/observability**: TypeORM migrations/entities for domain state and logs; global correlation/logging/metrics/error-alerting/audit interceptors and middleware.

## 7) Navigation guide (where to start)

- Runtime/bootstrap and global policy: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/common/http/api-prefix.ts`.
- Auth and identity: `modules/auth/better-auth.ts`, `modules/auth/auth.module.ts`, `modules/auth/guards/jwt-auth.guard.ts`, `modules/api-key/*`, `modules/user/*`, `modules/organization/*`.
- Tenancy/project/access: `modules/tenant/*`, `modules/tenant-member/*`, `modules/project/*`, `modules/invite/*`.
- Messaging/notifications core: `modules/messaging/*` (queue, repositories, controllers, unified send), `modules/notifications/*` (engine, storage, transport, center, gateway), `modules/preferences/*`, `modules/topics/*`, `modules/in-app/*`, `modules/channels/*`.
- Provider/delivery adapters and BYOP: `modules/provider/*` (especially `provider-orchestrator.service.ts`, `provider.module.ts`, `controllers/`, `services/`, `providers/*`), `modules/whatsapp/*`, `modules/webhook/*`, `modules/push-certificates/*`.
- Product workflows and content: `modules/campaign/*`, `modules/workflow/*`, `modules/template/*`, `modules/analytics/*`.
- Billing/quotas/compliance: `modules/billing/*`, `modules/quotas/*`, `modules/compliance/*`, `modules/configuration/*`.
- Shared platform concerns: `apps/api/src/common/{database,logging,errors,monitoring,security,throttler,guards,interceptors,middleware,enums,utils}` and `apps/api/src/config/*`.
