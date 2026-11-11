# [009] External integrations and providers

- **Label:** `wayfinder:research`
- **Status:** closed (resolved)
- **Parent map:** [Whole-repo understanding map](../MAP-001-whole-repo-understanding.md)
- **Blocked by:** none (informed by [006], [008])
- **Blocks:** none (informs fog graduation)

## Question

What external integrations and provider surfaces does Sanarwa implement or depend on — channel providers/adapters (email/SMS/push/WhatsApp/chat/voice/webhook), BYOP config/credential flows, inbound/outbound webhooks, billing/payments (e.g. Bachs), and MCP/tooling surfaces — and how are they wired, secured, and operated? If understanding reveals concrete correctness/stability issues, scoped fixes, refactors, or migrations may be included.

## Resolution

# [009] External integrations and provider surfaces

**Scope method (medium thoroughness, read-only):** grounded in the files under `apps/api/src/modules/provider/**`, `apps/api/src/modules/billing/**`, `apps/api/src/modules/webhook/**`, `apps/api/src/modules/mcp/**`, `apps/api/src/modules/analytics/{webhook.service.ts,queue/*}`, `packages/mcp/**`, plus `CONTEXT.md`, `.env.example`, and supporting provider/webhook utilities. No files were created, modified, or branched.

---

## 1) Domain/architecture snapshot (integration-relevant)

- `CONTEXT.md` defines Sanarwa as a multi-tenant notification platform; sending is token-billed. Tenancy root is **Tenant**, API keys are **project-scoped** (`tenantId` + `projectId`). Channels are the `NotificationChannel` enum (`email|sms|push|whatsapp|in_app|voice|webhook|chat`). Providers are external delivery services; **managed** = Sanarwa credentials, **BYO/BYOP** = tenant-supplied credentials for integrated providers. `ProviderOrchestratorService` “resolves BYOP first, then falls back to the managed provider, and charges for the send.” ZeptoMail is the managed email provider; **SES is BYOP-only**. Billing modes `managed|byo`, welcome tokens 3000.
- `.env.example` documents platform-level integration env (Telnyx, WhatsApp/Meta app secrets, VAPID, AWS SES/SNS, regional SMS, OAuth, JWT, `PROVIDER_ENCRYPTION_KEY`, `WEBHOOK_SECRET`, `BACHS_*` implied by code but not listed here) and explicitly states: **“Slack, Discord, Telegram: BYOP per tenant … Do NOT set platform tokens here”**.
- `apps/api/src/modules/billing/PROVIDER-AUDIT.md`: **Bachs is the only payment provider** (Polar/Nomba removed 2026-10-10). Records fixed Bachs contract bugs (fixed price override shape, cancel-at-period-end verb, `OVERPAID` handling, null `charge_id` fallback, V2 signature rotation support). Notes: **subscriptions not implemented** (Bachs has no create-subscription endpoint), **off-session charging unsupported** so auto-topup cannot bill a saved card, `billing_currency` + explicit price override is an open sandbox question. Lists SMS/email/push/voice/chat providers as “not yet audited” against vendor docs.

---

## 2) Channel providers, adapters, and runtime wiring

### 2.1 Provider module composition and registration

- `apps/api/src/modules/provider/provider.module.ts`
- Imports channel submodules `EmailModule`, `ChatModule`, `PushModule`, `SMSModule`, `InAppModule`, `VoiceModule`, plus `BillingModule`, `ApiKeyModule`, `TokenManagementModule`, `BrandModule`, `DeliveryEventsModule`, `ErrorsModule`, security/auth/tenant modules; persists `ProviderConfig`, `ProviderUsageLog`, `DeviceRegistration`, `NotificationLog`.
- Controllers: `ProviderConfigController`, `BYOPController`, `DeviceRegistrationController`, `TelnyxWebhookController`, `WhatsAppWebhookController`, `EmailWebhookController` (note: `SMSWebhookController` exists in tree but is **not listed in this module’s controllers array**).
- `PROVIDER_REGISTRATIONS` factory registers:
- **Factory-based (/provider-factory):** `aws_ses`→EMAIL/`SESEmailProvider`, `aws_sns`→SMS/`SNSSMSProvider`, `termii`→SMS/`TermiiSMSProvider`, `asia_sms`→SMS/`AsiaSMSProvider`, `aws_pinpoint`→PUSH/`PinpointPushProvider`, `whatsapp_business`→WHATSAPP/`MetaWhatsAppProvider`.
- **Orchestrator email:** `zeptomail`, `mailgun`, `sendgrid`, `ses` (comment: “SES is BYOP only. Register it but never as the managed fallback.”), `smtp` — each with singleton + BYOP factory.
- **Orchestrator chat:** `slack`, `discord`, `telegram`, `whatsapp` with factories mapping tenant config keys (`botToken/token/webhookUrl`, `webhookUrl/username/avatarUrl`, `botToken/parseMode/defaultChatId`, `accessToken/phoneNumberId/.../appSecret/apiVersion`).
- **Orchestrator push:** `fcm`, `expo-push`, `sns` (comment: “BYOP-only… FCM/APNs/Expo/WebPush are the managed path”), `apple-push` with `configServiceFrom(...)` shims over credential aliases; `web_push` registered **without factory** (“deliberately not BYOP-instantiable: it needs the subscription service, not just credentials”).
- **Orchestrator SMS:** `twilio`, `termii`, `africastalking` with factories (env-key aliases mapped to tenant config). `smsRoutingService.registerProvider(provider)` is called on SMS registration (`ProviderOrchestratorService.registerSMSProvider`).
- Exports include orchestrator, config/crypto/validation/perf/cost/template/routing services, branded push, device registration, smart push router.

- `apps/api/src/modules/provider/byop-config.shim.ts`: `configServiceFrom(config)` returns a `ConfigService`-shaped shim (`get(key,fallback)`) so providers that read env-style keys can consume decrypted tenant BYOP config objects without rewrites.

- `apps/api/src/modules/provider/provider-config.entity.ts`: `provider_configs` (uuid PK, `project_id`, `provider_id`, `provider_name`, `provider_type` enum, `channel` varchar(20)/`NotificationChannel`, `config json`, `priority`, `is_active`, `is_default`, `supported_countries`, `rate_limits`, `metadata`, timestamps, relations to `Project`/`TenantMember`). Indexes on `[projectId,channel]`, `[projectId,isActive]`; unique `[projectId,providerId,channel]`. `tenantId` derived via `project.tenant`.

- `apps/api/src/modules/provider/provider-config.repository.ts`: tenant/project-scoped queries (`findByTenantId`, `findByProjectId`, `findActiveByTenantAndChannel` ordered by priority, `findByIdAndTenant`, `findByProviderAndTenant`) joining through project.

### 2.2 Orchestrator: routing, BYOP resolution, fallback, circuit-breaking, billing

- `apps/api/src/modules/provider/provider-orchestrator.service.ts`
- Registries/factories per channel (`email/chat/push/sms`). Managed chains: email `['zeptomail','mailgun','sendgrid']`; push `['fcm','apple-push','expo-push']` (SNS intentionally excluded from managed chain, BYOP-only). SMS managed chain is dynamic from `SMSRoutingService.getPreferredProviders(...)` (deduped by provider name), per-destination for single send, first-recipient-based for bulk.
- `sendEmail`: requires tenant; resolves BYOP email via active provider config for tenant+channel. BYOP path instantiates via factory (email factory `initialize()` called), sends behind `byo-email:{tenant}:{provider}` circuit, charges `managed? no, "byo"` on sent. Managed path enhances payload with brand config/default from, runs `attemptManagedChain`, charges `managed` on sent; throws if all managed failed.
- `sendChatMessage`: resolves provider name (`aws_ses→ses`, `whatsapp_business→whatsapp` alias). **Chat and WhatsApp are BYOP-only** — if no resolved BYOP mode, throws `BadRequestException("No {resolvedName} connection is configured for this tenant. Connect it under Channels.")`. Uses per-tenant/provider circuit key `byo-{chat|whatsapp}:{tenant}:{provider}` and charges `byo` on sent (channel billing `CHAT` or `WHATSAPP`).
- `testChatConnection`: BYOP-only probe, **bypasses managed providers, token billing, and circuit breaker** (intentional). Optional `verifyOnly` uses provider `verifyCredentials` if present; otherwise sends payload and normalizes outcome.
- `sendPushNotification`: BYOP or managed chain fallback; brand-enhanced payload for managed; charges accordingly.
- `sendSMS` `sendBulkSMS`: BYOP or routing-preferred managed chain; bulk charges by `recipientCount`; bulk chain preference derived from first recipient.
- `sendVoiceCall`: requires `to[0]`, calls `VoiceService.createOutboundCall` via Telnyx behind `voice:{tenant}:telnyx` circuit, charges **managed VOICE** with metadata `{durationMinutes:1, callControlId}` on success.
- `sendInAppNotification` room/call helpers: delegates to `InAppOrchestratorService` (DB/internal), **no circuit breaker** for in-app write; in-app send charges managed `IN_APP`.
- Provider outcome/circuit policy (`ProviderSendOutcome`, `toProviderSendOutcome`): retryable failures (`retryable !== false` on failed outcome) count toward circuit (`ProviderOutcomeFailure` thrown inside `circuitBreaker.execute`); BYOP converts circuit-open/failure outcomes to failed `ProviderSendOutcome` (not charged). Managed chain prunes invalid push tokens on outcomes carrying `failedTokens`.
- BYOP config source: `providerConfigRepository.findActiveByTenantAndChannel(tenantId, channel)`; decrypts via `ProviderEncryptionService.decrypt`; name normalization/aliasing applied.
- `getAvailableProviders(type)` exposes registered names; voice hardcoded to `['telnyx']`.

### 2.3 Alternate provider service factory path (parallel implementation)

- `apps/api/src/modules/provider/provider.service.ts`
- Separate `send/sendBulk` over `ProviderFactory` + repository-selected `ProviderConfig`s (tenant via `project.tenantId`), per-provider **Redis-backed circuit breakers** (`provider:circuit:{providerId}`), performance filtering (`PROVIDER_MIN_SUCCESS_RATE`, default 80), priority ordering, country filtering, exclusion, optional decrypt-on-read.
- Bulk batch size from `PROVIDER_BULK_BATCH_SIZE` (default 250) except `voice` fixed to 10.
- CRUD/config-management methods (`createConfig/findAllConfigs/findConfigsByProject/findConfigById/updateConfig/removeConfig/activateConfig/deactivateConfig/updateProviderConfig/toggleProvider`) mostly encrypt/decrypt configs and manage an instance cache.
- Uses `ProviderConfigValidator` and `ProviderEncryptionService`.

- `apps/api/src/modules/provider/provider-config-validator.ts`: schema-based validation by `{channel}:{providerId}` (with channel fallback in logic) for required/optional/`requiredAny`, field validators, rate limits, supported countries; includes schemas for `aws_ses/ses`, `sendgrid`, `mailgun`, `resend`, `zeptomail`, `smtp`, `aws_sns` SMS, `termii`, `aws_pinpoint`, `slack`, `discord`, `telegram`, `whatsapp/whatsapp_business`. (Notably omits explicit schemas for several orchestrator-registered providers such as `twilio/africastalking` SMS, `fcm/expo-push/apple-push/sns/web_push`, etc.)

### 2.4 Implemented channel/provider surface (observed from tree)

- **Email:** `providers/email/*` (+ `ses/smtp/sendgrid/mailgun/resend/zeptomail`), managed chain zeptomail→mailgun→sendgrid; SES BYOP-only.
- **SMS:** `providers/sms/*` with `twilio`, `termii`, `africastalking` (and other provider files present in glob e.g. `infobip`, `telnyx`, `asia-sms/sns` adapters elsewhere/factory side); smart/routing services exist.
- **Push:** `providers/push/*` with `fcm`, `expo-push`, `sns`, `apple-push`, `web-push`; device registration/web-push subscription/branded/smart router services.
- **Chat:** `providers/chat/*` with `slack`, `discord`, `telegram`, `whatsapp`; BYOP-only send path.
- **WhatsApp:** exposed as chat-provider alias `whatsapp_business`→`whatsapp` and as `NotificationChannel.WHATSAPP` in orchestrator routing/billing; dedicated Meta/WhatsApp adapters exist.
- **Voice:** `services/voice.service.ts`, `providers/voice/*`, Telnyx voice webhook controller; orchestrator sends via Telnyx only.
- **In-app:** internal orchestrator/service (no external provider).
- **Webhook channel:** enum exists; outbound tenant webhooks are handled in analytics/webhook modules (separate from “channel provider” adapters).

---

## 3) BYOP configuration and credential flows

### 3.1 Storage, encryption, tenancy, and lifecycle

- **Model:** `ProviderConfig` is project-scoped (`projectId`, unique per project/provider/channel), channel-typed, priority/active/default flags, arbitrary JSON `config`, optional rate limits/countries/metadata (`provider-config.entity.ts`).
- **Encryption:** `ProviderEncryptionService` (`provider-encryption.service.ts`) delegates to `common/security/services/encryption.service` for `encryptProviderConfig` `decryptProviderConfig` (and value-level helpers, integrity check via decrypt, key utils). `.env.example` requires `PROVIDER_ENCRYPTION_KEY` (exactly 32 chars). BYOP resolution decrypts config before validation/instantiation (`ProviderOrchestratorService.toByopConfig/getBYOPProvider`; `ProviderService` decrypts on select/read/update/create paths).
- **Validation:** `ProviderConfigValidator` enforces required fields/aliases and format checks per provider schema (see §2.3). `ProviderService.createConfig/updateConfig` encrypt and (on create) runs validation warning-log if invalid.
- **APIs (tenant/project-scoped, guarded):**
- `ProviderConfigController` at `tenants/:tenantId/projects/:projectId/provider-configs` (`AuthGuard` + `TenantMemberGuard`, bearer auth): create/list (paginated), list by project, get/update/delete, activate/deactivate; delegates to `ProviderService` (`provider-config.controller.ts`).
- `BYOPController` at `tenants/:tenantId/projects/:projectId/byop` (`TenantMemberGuard`): template discovery/search/popular/get, template validate/hints, recommendations, cost analytics/trends/comparison/alerts/optimization, provider usage, `calculate-cost`, channel `setup-guide`, and `bulk-setup` that validates templates then creates configs via `ProviderService.createConfig` (`byop.controller.ts`, `ProviderTemplateService`, `ProviderCostTrackerService`).

### 3.2 Runtime BYOP behavior

- `ProviderOrchestratorService.resolveManagedProvider`: if an active, decryptable, `validateConfig`-passing BYOP config exists for tenant/channel/(optional provider), it returns `mode:"byo"` and that provider/config; otherwise no managed fallback is selected here except by caller logic. Chat/WhatsApp enforce BYOP-only (hard error when absent). Email/push/SMS fall back to managed chains when no BYOP selected.
- BYOP providers are instantiated per-send from decrypted config via registered factories (or singleton fallback when no factory), with `configServiceFrom` bridging env-keyed provider constructors.
- **Constraint:** `web_push` has no BYOP factory (requires subscription service). SES email is registerable but excluded from managed fallback chain.

### 3.3 Notable correctness/stability issues (BYOP/provider config)

- **`ProviderService` tenant scoping cache-key bugs (high risk, correctness/security):**
- `toggleProvider` calls `repository.update({ tenantId, providerId, channel },...)` (`provider.service.ts` ~L498-L504) but `ProviderConfig` has no `tenantId` column (tenant is via `project` relation). This is unlikely to behave as intended and may no-op/fail depending on TypeORM behavior.
- `getProviderCacheKey` returns `${config.tenantId}:${config.providerId}:${config.channel}` (~L586-L588), but selected entities do not populate `tenantId` as a plain column in queries shown; this can collapse/poison cache keys (e.g. `undefined:*`) across tenants/providers in this service’s instance cache.
- `recordFailure` computes `responseTime` as `Date.now() - Date.now()` (~L89-L96 path in `send`) — always 0.
- `send` circuit-breaker check is `await circuitBreaker.isOpen()` before attempt but does not re-check on concurrent races; Redis-backed state is simple (no half-open probe logic beyond timeout expiry).
- **Dual provider execution models:** `ProviderModule` wires both `ProviderFactory`/`ProviderService` and `ProviderOrchestratorService` registries/chains. This increases drift risk (different provider sets, different circuit-breaking/billing semantics) unless callers are consistently aligned; worth an explicit ownership decision.
- **Controller/guard inconsistency:** `ProviderConfigController` uses `AuthGuard, TenantMemberGuard`; `BYOPController` uses `TenantMemberGuard` only (both bearer-declared). Depends on guard implementation, but worth verifying intended auth composition.
- **Config validation coverage gap:** orchestrator can register/use providers (e.g. Twilio, Africa’sTalking, FCM, Expo, APNs, SNS push, web_push) without corresponding `ProviderConfigValidator` schemas, reducing pre-save correctness guarantees for BYOP credentials.

---

## 4) Inbound (provider → Sanarwa) webhook surfaces

### 4.1 Shared verification primitive

- `apps/api/src/modules/provider/services/webhook-validator.service.ts`
- Providers: `whatsapp | twilio | sendgrid | mailgun | telnyx | resend`.
- Verification modes: **WhatsApp** HMAC-SHA256 over raw body with `x-hub-signature-256` (`sha256=` prefix). **Twilio** HMAC-SHA1 base64 over `${url}${rawBody}` with `x-twilio-signature` (requires request URL). **Telnyx** Ed25519 verify of `timestamp|rawBody` using configured public key and `telnyx-signature-ed25519`/`telnyx-timestamp`. **SendGrid** ECDSA/SHA256 public-key verify over `timestamp+rawBody` (`x-twilio-email-event-webhook-signature`, `x-twilio-email-event-webhook-timestamp`, 300s tolerance). **Mailgun** HMAC-SHA256 over `${timestamp}${token}` with `x-mailgun-signature/timestamp/token` (900s tolerance). **Resend** Svix-style HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${rawBody}` with base64 secret (`whsec_` stripped), multi-candidate signatures, 300s tolerance.
- Rejects on missing/invalid secret/key, malformed/stale timestamp, missing URL (Twilio), signature mismatch; constant-time comparison for presented digests.

- `apps/api/src/modules/provider/services/sns-message-verifier.service.ts`: verifies SNS `SignatureVersion=1` by allow-listing HTTPS `sns.*.amazonaws.com` cert URLs, fetching/caching certs (5s timeout), building canonical signed-field string, verifying SHA-256 signature.

### 4.2 Provider inbound controllers

- **Email provider webhooks (BYOP/tenant-scoped + SES SNS):** `apps/api/src/modules/provider/controllers/email-webhook.controller.ts` (`@Public`, `@SkipThrottle`, `POST /webhooks/email/...`)
- `POST sendgrid/:tenantId`, `mailgun/:tenantId`, `resend/:tenantId`: resolve tenant’s active email provider config by `providerId`, decrypt, read `webhookPublicKey` (SendGrid) or `webhookSecret` (Mailgun/Resend), verify against raw body/headers via `WebhookValidatorService`; on rejection `401`. Normalizes events (`normalizeSendGridEvent/Mailgun/Resend`) and ingests via `DeliveryEventService.ingestProviderFeedback`; returns per-event outcomes.
- `POST ses`: verifies SNS envelope cert/signature; handles `SubscriptionConfirmation` as no-op log; parses `Message` JSON and normalizes SES event with `providerEventId = envelope.MessageId` for dedupe; ingests.
- Key lookup is per-tenant/provider from stored provider config (good isolation for BYOP signing keys).

- **WhatsApp (Meta Cloud):** `apps/api/src/modules/provider/controllers/whatsapp-webhook.controller.ts` (`@Public`, `@SkipThrottle`, `GET|POST /webhooks/whatsapp`)
- `GET` verification uses env `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (hub challenge handshake).
- `POST` verifies `x-hub-signature-256` using env `WHATSAPP_APP_SECRET` via `WebhookValidatorService`; requires object `whatsapp_business_account`; emits `whatsapp.message.received` and `whatsapp.status.updated` domain events with normalized payloads/conversation IDs.

- **SMS inbound/status:** `apps/api/src/modules/provider/controllers/sms-webhook.controller.ts` (`@Public`, `@SkipThrottle`, `/webhooks/sms`)
- `twilio/inbound` and `twilio/status`: verify via `WebhookValidatorService` using env `TWILIO_AUTH_TOKEN` and env `TWILIO_WEBHOOK_URL` (Twilio HMAC requires exact URL) against raw body; emits `sms.inbound.received` `sms.status.updated`.
- `telnyx/inbound`: verifies Ed25519 signature using env `TELNYX_PUBLIC_KEY` over `JSON.stringify(body)` + headers; emits inbound event.
- `termii/inbound`, `infobip/inbound`: **no signature verification implemented in controller** (comments/placeholders absent checks), normalize and emit events.
- `status/:provider` generic endpoint logs and emits `sms.status.generic` without verification.
- **Wiring note:** controller file exists but is **not registered in `ProviderModule.controllers`** (see §2.1), so these routes may be inactive unless imported elsewhere.

- **Telnyx voice:** `apps/api/src/modules/provider/controllers/telnyx-webhook.controller.ts` (`@Public`, `@SkipThrottle`, `POST /webhooks/telnyx/voice`)
- Logs/dispatches `call.initiated|call.answered|call.hangup|call.speak.*`; on answered, can play TTS from base64 `X-TTS-Message` custom header via `VoiceService.sendTTSToCall`.
- Accepts `telnyx-signature-ed25519`/`telnyx-timestamp` params but **does not verify** them before processing.

- **Billing provider inbound (Bachs):** `apps/api/src/modules/billing/controllers/billing.controller.ts` exposes `POST /billing/webhooks/bachs` (`@Public`, `@SkipThrottle`) requiring `rawBody`; delegates to `BillingWebhooksService.handleBachsWebhook` (see §6).

### 4.3 Inbound webhook security/operational observations

- **Good:** email BYOP webhooks are tenant-scoped and verified against tenant-stored keys; SendGrid/Mailgun/Resend/Twilio/Telnyx verifiers and SNS cert verifier are implemented with constant-time/signature and timestamp controls where applicable. Most provider webhook controllers are public + throttle-skipped (expected for callbacks).
- **Gaps/risks:**
- `SMSWebhookController` appears unmounted by `ProviderModule`.
- `TelnyxWebhookController` (voice) does not perform signature verification despite taking headers and despite `WebhookValidatorService` supporting Telnyx Ed25519.
- `sms/termii/inbound`, `sms/infobip/inbound`, and generic `sms/status/:provider` perform no authenticity checks.
- WhatsApp post-webhook verification depends on a single global `WHATSAPP_APP_SECRET` env (fits a single Meta app) while delivery config can be tenant/BYOP in other areas; ensure this matches intended deployment model.

---

## 5) Outbound webhooks (Sanarwa → tenant endpoints)

### 5.1 Tenant webhook configuration/storage

- `apps/api/src/modules/webhook/entities/webhook.entity.ts`: `webhooks` table (tenant-scoped, indexed by `tenantId`, `active`) with `name`, `url`, optional `secret`, `events` (`jsonb` of typed `WebhookEvent` union covering email/sms/push/whatsapp sent/delivered/failed/opened/clicked/bounced/complained/unsubscribed + `notification.bulk_completed`), relation to `Tenant`.
- `apps/api/src/modules/webhook/webhook.service.ts`: CRUD with tenant isolation, URL uniqueness per tenant, and **SSRF/safety validation** via `assertSafeWebhookUrl` on create/update; `findActiveWebhooksForEvent(tenantId,event)` query (`:event = ANY(webhook.events)`).
- `apps/api/src/modules/webhook/webhook.controller.ts`: `tenants/:tenantId/webhooks` CRUD under `TenantMemberGuard` + bearer auth; maps entity to response DTO.
- `apps/api/src/modules/webhook/webhook.module.ts`: TypeORM feature + controller/service export.

### 5.2 Delivery/dispatch pipeline (analytics)

- `apps/api/src/modules/analytics/webhook.service.ts` (outbound dispatcher)
- Sends delivery status/event/bulk-completion webhooks by looking up active tenant webhooks for specific event names (`email.delivered`, `email.{opened|clicked|unsubscribed}`, `notification.bulk_completed`) via optional `DatabaseWebhookService` (`modules/webhook`).
- Builds payloads `{ type: "delivery_status_update" | "delivery_event" | "bulk_notification_complete", timestamp, data{...ISO timestamp} }`, includes headers `Content-Type`, `X-Webhook-Signature` (HMAC-SHA256 hex of JSON payload when secret present), `X-Idempotency-Key`, `X-Attempt`.
- First attempt inline with axios (timeout default 10s, 2xx required). On failure: queues retry to BullMQ via optional `WebhookQueueService` (starting attempt 2) or falls back to synchronous exponential backoff loop.
- Validates outbound URL with `assertSafeWebhookUrl` before send. `getWebhookStats` is stubbed to zeros.
- `apps/api/src/modules/analytics/queue/webhook-queue.service.ts` `webhook-queue.constants.ts`
- Queue `webhook-retry-queue` (BullMQ, `@nestjs/bullmq`), job payload includes tenant/url/payload/secret/headers/timeout/idempotency/attempt/maxRetries; deterministic job id `${idempotencyKey}-attempt-${attempt}`; exponential delay `min(2^(attempt-1),300)` seconds; stats/clear/retry helpers.

### 5.3 Outbound webhook observations

- **Good:** destination URL safety check, per-webhook optional secret signing, idempotency key propagation, async retry queue with sync fallback.
- **Potential issues/gaps:**
- Event subscription matching is narrow/hardcoded in dispatcher (`sendDeliveryStatusWebhook` queries only `email.delivered`; event webhook queries `email.{eventType}`; no generic dispatch across all `WebhookEvent`s stored on entity). Stored event taxonomy is broader than dispatch paths shown.
- Signature scheme is simple HMAC-SHA256 over JSON string (no timestamp header/versioned scheme) — adequate but consumers must match exact serialization.
- `getWebhookStats` unimplemented (returns zeros).

---

## 6) Billing, payments, and Bachs integration

### 6.1 Module and APIs

- `apps/api/src/modules/billing/billing.module.ts`: registers entities `Subscription`, `TokenPurchase`, `AutoTopupConfig`, `TokenBalance`, `TokenTransaction`, `WebhookEvent`, `TenantPaymentMethod`, `Tenant`; providers/services for token purchase, checkout provider, auto-topup, webhooks, Bachs, payment methods, token management/integration/welcome listener; controller guarded by auth + tenant context.
- `apps/api/src/modules/billing/controllers/billing.controller.ts` (`/billing`, `AuthGuard+TenantContextGuard` unless `@Public`)
- Token purchase lifecycle: `POST /tokens/purchase`, `GET /tokens/purchase/:purchaseId`, `POST /tokens/purchase/:purchaseId/sync`; balance/transactions/usage-stats endpoints.
- Auto-topup config get/set; payment method setup/list/revoke (`POST /payment-methods/setup`, `GET /payment-methods`, `DELETE /payment-methods/:id`).
- Public context/catalog: `GET /checkout/context`, `GET /token-packages` (returns package catalog + welcome/pricing constants including BYO/managed rates and eligible/managed-only channels).
- Public inbound: `POST /webhooks/bachs` (SkipThrottle, requires raw body) → `BillingWebhooksService.handleBachsWebhook`.

### 6.2 Bachs client and webhook processing

- `apps/api/src/modules/billing/services/bachs.service.ts`
- Config-driven base URL (`BACHS_BASE_URL` or sandbox/prod inferred from `sk_sandbox_` secret), secret `BACHS_SECRET_KEY`, per-currency product IDs (`BACHS_PRODUCT_ID_USD|NGN`), webhook secret getter, web origin from `WEB_ORIGIN|FRONTEND_URL`.
- Checkout: `initializeCheckout` `createCheckoutSession` posts to `/v1/checkout-sessions` with `product_cart` (fixed-price override as `pricing: { price_type: "fixed", amount }` per audit), customer, `billing_currency`, success/cancel URLs, reference, metadata; returns checkout URL/id/reference. Builds success/cancel URLs for purchase and payment-method setup.
- Verification: `verifyCheckoutSession` maps session/charge/payment statuses to success/pending/failed (treats succeeded/accepted/overpaid/completed as success; expired/cancelled/failed as failed).
- Payment-method setup: card-vault setup checkout (configurable amount, default `1.00`), fetch checkout session details (customer/payment method/subscription/card hints), cancel subscription-at-period-end via `DELETE /v1/subscriptions/{id}` (best-effort/warn).
- **Off-session:** `chargeOffSession` logs warning and returns `{status:"failed", errorCode:"OFF_SESSION_NOT_SUPPORTED"}` (no Bachs off-session support).
- Errors: typed `BachsCheckoutInitError` for checkout init failures.

- `apps/api/src/modules/billing/utils/bachs-webhook.util.ts`
- Signature verification: prefers `X-Bachs-Signature-V2` (`t=...,v1=...[,v1=...]`) supporting secret rotation; falls back to `X-Bachs-Signature` + `X-Bachs-Timestamp`. HMAC-SHA256 over `${timestamp}.${rawBody}`, 300s skew tolerance, timing-safe compare.
- Parses payload/reference/metadata to derive `purchaseId`, `setupReference`, tenant/currency/customer/payment/subscription context.
- Outcomes: ignores abandoned/underpaid; handles `customer.subscription.created|updated` (success only for setup purpose/reference/status-eligible, else ignored/failed mapping), `collection.succeeded`/`collection.failed` mapped to success/failed when correlatable identifiers exist (charge/checkout/reference/setup/purchase); drops uncorrelatable/invalid-success-status cases.

- `apps/api/src/modules/billing/services/billing-webhooks.service.ts`
- Verifies Bachs webhook; throws `BadRequestException` on invalid signature/payload verification failure.
- **Idempotency/dedup:** `webhook_events` insert claim on `(provider="bachs", eventId)` with SHA-256 payload hash; unique-violation (`23505`) treated as duplicate `{received:true, duplicate:true}`. `eventId` falls back to hash of `${eventType}:${rawBody}` if absent.
- Dispatch: on setup success (with `setupReference`+`tenantId`) completes payment method setup via `AutoTopupService`; on purchase success confirms via `TokenPurchaseService.confirmTokenPurchaseIfPaid`; on purchase failure marks failed. Ignored outcomes acknowledged.

- `apps/api/src/modules/billing/entities/webhook-event.entity.ts` (present in module): persistence for claimed webhook events (supports dedupe).

### 6.3 Billing/provider observations

- **Good:** raw-body webhook verification, V1/V2 signature support and rotation-aware verification, replay/idempotency claim, explicit handling for Bachs contract quirks documented in audit.
- **Operational/functional constraints (documented/implemented):**
- Off-session charging unsupported → auto-topup cannot charge saved cards automatically (`bachs.service.ts`, `PROVIDER-AUDIT.md`).
- Subscriptions not implemented as a first-class flow in this integration.
- Open question: interaction of `billing_currency` with explicit fixed-price override (audit notes sandbox confirmation needed).
- **Potential issue:** webhook claim happens before business handling; if downstream confirmation/setup throws after insert, the event is marked claimed/deduped but processing may not complete (depends on transaction/outbox strategy; current code does not show compensating reprocessing).

---

## 7) MCP and tooling surfaces

### 7.1 API-hosted MCP server (tenant-scoped, authz-gated)

- `apps/api/src/modules/mcp/mcp.module.ts`: mounts `McpModule.forRootAsync` at path `mcp` with `@Public()` decorator on transport endpoint and custom auth verifier; imports `ApiKeyModule`, `AnalyticsModule`, `MessagingModule`, `TokenManagementModule`. Server metadata: name `sanarwa`, instructions emphasize token-balance check before sends, transient vs persisted message IDs, scope-based tool access; OAuth/resource metadata configured from `MCP_RESOURCE` and `MCP_AUTHORIZATION_SERVER` with `scopesSupported = MCP_SCOPES`.
- `apps/api/src/modules/mcp/api-key-token.verifier.ts`: verifies bearer token as API key via `ApiKeyService.validateApiKey`; rejects if no tenant; returns `AuthInfo` with `clientId=apiKey.id`, `scopes=apiKey.permissions`, `resource=MCP_RESOURCE` (default `http://localhost:3000/mcp`), 1h expiry, and `extra.{tenantId, projectId, keyPrefix, environment}`.
- `apps/api/src/modules/mcp/mcp-scopes.ts`: supported scopes `notifications:send|read`, `templates:read`, `analytics:read`, `billing:read`.
- `apps/api/src/modules/mcp/mcp.tools.ts` (`SanarwaMcpTools`, call logging interceptor)
- Tools: `get-token-balance` (`billing:read`, read-only), `get-delivery-analytics` (`analytics:read`, last-30-day scheduled analytics), `get-notification-status` (`notifications:read`, persisted scheduled messages only), `send-notification` (`notifications:send`, side-effecting/open-world, spends tokens).
- All tools derive `{tenantId, projectId}` from `ctx.authInfo.extra` and **require tenant-scoped credential**; send passes channels/recipients/variables/template/subject/data/priority/metadata (injects `projectId` when present) to `MessagingService.sendMessage`.
- Input schema allows channels `email|sms|push|whatsapp|voice` (not in-app/chat/webhook) with max 1000 recipients.
- `apps/api/src/modules/mcp/mcp-call-logging.interceptor.ts` exists (not read in detail) — operational auditing hook for tool calls.

### 7.2 Standalone MCP package (`packages/mcp`)

- `packages/mcp/README.md`: MCP server exposing **9 tools** over Sanarwa notification API (stdio default, `--http` supported), requires `SANARWA_API_KEY` (exit 2 if missing), configurable `SANARWA_BASE_URL` (default `https://api.sanarwa.com/api/v1`), transport/host/port envs, HTTP `/health`. Tools map to OpenAPI operations and translate flat tool inputs to SDK shapes; upstream failures returned as tool error results.
- `packages/mcp/src/server.ts`: builds `McpServer("sanarwa","0.1.0")` with `@sanarwa/sdk` client and registers tools: `notification_send`, `notification_send_bulk`, `notification_status`, `notification_analytics`, `notification_health`, `push_send`, `push_send_bulk`, `whatsapp_send`, `whatsapp_send_template` (each delegating to tool modules and wrapping results/errors).
- `packages/mcp/src/manifest.ts`: `OPERATION_BINDINGS` bind each tool to OpenAPI `method/specPath/path`; includes intentional translation cases (e.g. `push_send*` and `whatsapp_send` routed to `/notifications/send*`, `whatsapp_send_template` to `/whatsapp/messages/template`) to support drift tests against spec and served API routes.
- `packages/mcp/src/{index,config,tools/*}` and drift/unit tests present in package (dist also committed).

### 7.3 MCP observations

- **Two distinct MCP surfaces:** in-process, tenant/API-key-scoped Nest MCP (`apps/api/src/modules/mcp`) with fine-grained scope checks and direct service access; and external SDK-backed MCP package for agent clients with different tool names/capabilities (includes health/analytics/status/bulk/push/whatsapp-template ops by manifest) and env-based API key auth.
- **Security/ops:** in-API verifier binds tenant/project into auth context (good isolation). Package requires operator-supplied API key and supports localhost HTTP bind defaults.
- **Potential drift:** package README/manifest/tool set and server-side MCP tools are not 1:1; maintainers should treat `manifest.ts` + drift tests as source of truth for package behavior.

---

## 8) Configuration and environment dependencies (integration-focused)

From `.env.example`, `CONTEXT.md`, and code reads:

- **Core/security:** `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `PROVIDER_ENCRYPTION_KEY` (required), `WEBHOOK_SECRET` (declared), CORS/origins.
- **Payments (Bachs):** `BACHS_SECRET_KEY`, `BACHS_BASE_URL` (optional), `BACHS_PRODUCT_ID_USD|NGN`, `BACHS_WEBHOOK_SECRET`, `BACHS_CARD_SETUP_AMOUNT` (optional), `WEB_ORIGIN|FRONTEND_URL` (code; partially reflected in env template sections).
- **Email/push infra:** AWS SES/SNS credentials/regions/from fields; provider routing defaults (`EMAIL_PROVIDER`, `PUSH_PROVIDER`, etc.).
- **SMS/voice:** `TELNYX_*` (+ `TELNYX_WEBHOOK_URL`, `TELNYX_PUBLIC_KEY` used in code), regional SMS providers (Termii, Africa’sTalking), Twilio auth/webhook URL for inbound signature verification in code.
- **WhatsApp/Meta:** `WHATSAPP_API_VERSION`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `META_APP_ID|META_CONFIG_ID|META_APP_SECRET`, `WHATSAPP_APP_SECRET` (duplicate/alias in template); tenant sending credentials are BYOP per template note.
- **Push web:** `VAPID_PUBLIC_KEY|PRIVATE_KEY|SUBJECT`.
- **MCP (server):** `MCP_RESOURCE`, `MCP_AUTHORIZATION_SERVER`.
- **Chat:** no platform tokens in env; tenant BYOP via Channels/UI/config.
- **Stale/leftover:** `BETTER_AUTH_*` noted unused in `CONTEXT.md` (though other docs note Better Auth presence; treat `CONTEXT.md` + actual reads as authoritative for this ticket).

---

## 9) Concrete correctness/stability issues, scoped fixes/refactors, or migrations (observed)

> Grounded findings from inspected surfaces; items marked **potential** depend on runtime wiring/usage patterns.

1. **`SMSWebhookController` likely not exposed** — defined with multiple inbound/status routes but absent from `ProviderModule.controllers` (`apps/api/src/modules/provider/provider.module.ts`, `controllers/sms-webhook.controller.ts`).

- _Impact:_ inbound SMS/status callbacks (Twilio/Termii/Telnyx/Infobip/generic) may 404/not register.
- _Scoped fix:_ add to module controllers or confirm alternate module registration; add route-level integration test.

2. **Telnyx voice webhook lacks signature verification** — `TelnyxWebhookController.handleVoiceWebhook` accepts signature/timestamp headers but never validates before acting (`controllers/telnyx-webhook.controller.ts`), while `WebhookValidatorService` already supports Telnyx Ed25519.

- _Impact:_ spoofable/unauthenticated voice state transitions and TTS side effects.
- _Scoped fix:_ verify via `WebhookValidatorService` using configured Telnyx public key (global or tenant-resolved, per design) and reject on failure.

3. **Unauthenticated SMS webhook handlers** — `termii/inbound`, `infobip/inbound`, and generic `status/:provider` do not verify authenticity (`controllers/sms-webhook.controller.ts`).

- _Impact:_ forged inbound/status events.
- _Scoped fix:_ add provider-specific verification where secrets/keys exist; otherwise gate by shared secret/token/IP allow-list as interim control.

4. **`ProviderService` correctness bugs (alternate provider path)** (`apps/api/src/modules/provider/provider.service.ts`): `toggleProvider` filters on non-existent `tenantId` column; cache key uses `config.tenantId` (likely undefined) risking cross-tenant cache collisions; `recordFailure` logs zero response time.

- _Impact:_ broken toggle semantics, cache leakage/staleness, misleading metrics.
- _Scoped fix/refactor:_ query/update by relation (`project.tenantId`) consistently, derive cache key from trusted tenant/project+provider+channel, fix timing capture; add unit tests. Consider consolidating with orchestrator path to reduce drift.

5. **BYOP webhook key presence is mandatory for SendGrid/Mailgun/Resend but only format-validated if present** — validator schemas make `webhookPublicKey`/`webhookSecret` optional (`provider-config-validator.ts`), but inbound handlers reject when key missing (`email-webhook.controller.ts`).

- _Impact:_ tenant can save a config that cannot receive/verify delivery events.
- _Scoped fix:_ conditional required validation when webhook ingestion is enabled/expected, or surface stronger setup hints/warnings.

6. **Outbound analytics webhook dispatch/event coverage mismatch** — dispatcher listens/queries specific events (`email.delivered`, `email.{eventType}`, `notification.bulk_completed`) while tenant webhook entity supports broader `WebhookEvent`s (`analytics/webhook.service.ts`, `modules/webhook/entities/webhook.entity.ts`).

- _Impact:_ configured subscriptions for other events may never fire.
- _Scoped fix:_ unify event mapping/dispatch registry and test per event type.

7. **Billing webhook processing after idempotency claim is not obviously atomic** — Bachs event claim is inserted before downstream side effects (`billing-webhooks.service.ts`).

- _Impact:_ transient downstream failure can leave event permanently deduped without applied state change.
- _Scoped fix:_ wrap claim+handling in a transaction/outbox or mark processing state with retryable failure handling.

8. **Auto-topup/off-session limitation is real (by design/current provider capability)** — Bachs `chargeOffSession` always fails unsupported (`bachs.service.ts`), consistent with audit.

- _Impact:_ saved payment method/setup does not imply automatic recharge capability.
- _Scoped refactor:_ make UX/API semantics explicit and prevent enabling flows that imply unattended charging.

9. **Dual integration stacks model drift risk:** factory+`ProviderService` and orchestrator+channel modules coexist; `webhook` channel exists in enum but outbound delivery is implemented in analytics/webhook services rather than provider adapter; two MCP implementations serve different clients/shapes.

- _Impact:_ maintenance and behavior divergence.
- _Scoped refactor/migration:_ document canonical send path per channel, deprecate unused path, and align config/validation/provider registration sources.

---

## 10) Key file index (grounding)

- **Provider core:** `apps/api/src/modules/provider/provider.module.ts`, `provider-orchestrator.service.ts`, `provider.service.ts`, `provider-config.entity.ts`, `provider-config.repository.ts`, `provider-config.controller.ts`, `provider-config-validator.ts`, `provider-encryption.service.ts`, `provider-send-outcome.ts`, `byop-config.shim.ts`, `controllers/byop.controller.ts`
- **Inbound provider webhooks/verification:** `apps/api/src/modules/provider/controllers/email-webhook.controller.ts`, `whatsapp-webhook.controller.ts`, `sms-webhook.controller.ts`, `telnyx-webhook.controller.ts`, `services/webhook-validator.service.ts`, `services/sns-message-verifier.service.ts`
- **Outbound tenant webhooks & delivery:** `apps/api/src/modules/webhook/{webhook.module.ts,webhook.controller.ts,webhook.service.ts,entities/webhook.entity.ts}`, `apps/api/src/modules/analytics/webhook.service.ts`, `apps/api/src/modules/analytics/queue/{webhook-queue.service.ts,webhook-queue.constants.ts}`
- **Billing/payments (Bachs):** `apps/api/src/modules/billing/billing.module.ts`, `controllers/billing.controller.ts`, `services/{billing-webhooks.service.ts,bachs.service.ts}`, `utils/bachs-webhook.util.ts`, `entities/webhook-event.entity.ts`, `PROVIDER-AUDIT.md`
- **MCP:** `apps/api/src/modules/mcp/{mcp.module.ts,mcp.tools.ts,api-key-token.verifier.ts,mcp-scopes.ts,mcp-call-logging.interceptor.ts}`, `packages/mcp/{README.md,src/server.ts,src/manifest.ts,src/index.ts,src/config.ts,src/tools/*}`
- **Config/domain docs:** `.env.example`, `CONTEXT.md`
