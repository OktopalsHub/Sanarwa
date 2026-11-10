# [006] Messaging and notification pipeline end-to-end

- **Label:** `wayfinder:research`
- **Status:** closed (resolved)
- **Parent map:** [Whole-repo understanding map](../MAP-001-whole-repo-understanding.md)
- **Blocked by:** none (informed by [002], [003])
- **Blocks:** [External integrations and providers] fog graduation depends on this

## Question

How do send/ingest/inbound flows, the notification engine, queues (BullMQ), providers/BYOP orchestration, templates, campaigns, workflows, preferences/suppressions/quiet-hours, topics, inboxes, and delivery/log tracking compose end-to-end — including key data/control paths and failure/erasure touchpoints — stated clearly enough to navigate and explain the messaging pipeline? If understanding reveals concrete correctness/stability issues, scoped fixes, refactors, or migrations may be included.

## Resolution

# Ticket [006] — Messaging and notification pipeline end-to-end (code-grounded)

## Scope and primary seams

- **API ingress messaging orchestration**: `apps/api/src/modules/messaging/{messaging.module.ts,messaging.controller.ts,messages.controller.ts,notification.controller.ts,messaging.service.ts,notification.service.ts,unified-send.service.ts,resolve-address.ts,message-log.query.ts,message.entity.ts,message-delivery.entity.ts}`
- **Notification engine storage transport inbound center**: `apps/api/src/modules/notifications/{notifications.module.ts,engine/notification-engine.service.ts,engine/delivery-executor.service.ts,storage/notification-storage.service.ts,controllers/notification-transport.controller.ts,transport/inbound-email/email-inbound.controller.ts,entities/notification-log.entity.ts}` (+ notification-center/inbox/gateway services/controllers not exhaustively read but wired in module)
- **Queueing (BullMQ)**: `apps/api/src/modules/messaging/queue/{notification-queue.constants.ts,notification-queue.service.ts,notification-queue.module.ts,notification-queue-core.module.ts,notification.processor.ts,delivery.processor.ts,dead-letter.processor.ts,job-attempts.ts}`
- **Provider/BYOP orchestration & adapters**: `apps/api/src/modules/provider/{provider-orchestrator.service.ts,provider.service.ts,provider-config.entity.ts,provider-config.repository.ts,provider-encryption.service.ts,controllers/*webhook*.ts,providers/**}` (adapter files enumerated by glob; key behavior in orchestrator)
- **Templates**: `apps/api/src/modules/template/{template.service.ts,services/template-renderer.service.ts,services/template-validator.service.ts,services/template-versioning.service.ts,services/template-cache.service.ts,template.entity.ts}`
- **Campaigns Workflows**: `apps/api/src/modules/campaign/{campaign.service.ts,campaign.module.ts,entities/campaign.entity.ts}`, `apps/api/src/modules/workflow/{workflow.service.ts,workflow.module.ts,entities/workflow.entity.ts,entities/workflow-run.entity.ts}`
- **Preferences consent suppressions quiet hours erasure**: `apps/api/src/modules/preferences/{preferences.service.ts,consent.service.ts,services/quiet-hours.ts,subscriber-erasure.service.ts,entities/*.ts}`
- **Topics**: `apps/api/src/modules/topics/{topics.service.ts,entities/topic.entity.ts}`
- **In-app inbox/feed**: `apps/api/src/modules/in-app/{in-app.module.ts,services/in-app-feed.service.ts,controllers/in-app-inbox.controller.ts,gateway/in-app.gateway.ts}`, `apps/api/src/modules/notifications/services/inbox-erase.ts`
- **Delivery events webhooks feedback**: `apps/api/src/modules/messaging/events/{delivery-event.service.ts,email-event-normalizer.ts}`, `apps/api/src/modules/provider/controllers/email-webhook.controller.ts`
- **Related wiring**: `apps/api/src/modules/messaging/idempotency/*`, `apps/api/src/modules/quotas/*` (consumed), `apps/api/src/modules/notifications/enums/notification-storage-policy.enum.ts`

---

## 1) Entry points and send/ingest flows

### A. SDK/API message send (tenant-scoped, API-key authenticated) — queued multi-channel/fallback path

- **Controller**: `messaging/messaging.controller.ts`
- `POST /messaging/send` (`ApiKeyAuthGuard`, reads `req.apiKey.tenantId/projectId`, `x-idempotency-key`) -> `MessagingService.sendMessage(...)` (injects `metadata.projectId`).
- `POST /messaging/send-bulk` -> `MessagingService.sendBulkMessages(...)` (sequential per message).
- Read/cancel/edit/status/deliveries/stats endpoints delegate to `MessagingService` (`GET /messaging`, `/stats/delivery`, `/:id`, `/:id/status`, `/:id/deliveries`, `DELETE /:id`, `PATCH /:id`).
- **Service**: `messaging/messaging.service.ts`
- `sendMessage` requires `tenantId`, maps `SendMessageDto` into `UnifiedSendService.send(...)` (channels, recipients, template/vars, subject/data, scheduledAt, priority, brandId, chatProvider, fallback, metadata, idempotencyKey).
- `sendBulkMessages` loops and aggregates `successCount/failedCount` (logs errors, continues).
- `sendExternalNotification` is a convenience adapter into `sendMessage`.
- Digest/scheduling helpers exist here too: `sendWithDigest` queues into `DigestService` for non-instant frequencies (returns `queued_for_digest`; no actual delayed dispatch shown here), and `scheduleNotification` delegates per-recipient/channel to `SchedulingService` (separate in-memory/service scheduling abstraction from BullMQ message jobs).
- `getTenantMessages` reads from `NotificationLog` (`applyMessageLogFilters` in `message-log.query.ts`, joins `Message` by `metadata.messageId` for subject/content presence) — **log-centric list view**, not `messages` table.
- `getMessageDetail` resolves `NotificationLog` by id/trackingId/`metadata.messageId`, loads `Message` + `MessageDelivery[]`, builds a timeline (`queued/sent/delivered/failed/opened/clicked/bounced`) and returns delivery projections.
- `cancelMessage`/`updateScheduledMessage` only allow `PENDING` messages; edit can reschedule via `NotificationQueueService.rescheduleNotificationJob`.
- **`processMessage(messageId)`** is a separate, direct-send path (not the main queue processor): loads `Message`, requires `metadata.projectId`, resolves addresses per channel inline, calls `NotificationEngineService.send(...)` per recipient, then sets `Message.status` to `DELIVERED/PARTIALLY_DELIVERED/FAILED` and writes aggregate outcome. This bypasses `MessageDelivery`/per-delivery queue/fallback/consent-at-delivery handling used by the BullMQ pipeline.
- **Unified send (core queued fan-out)**: `messaging/unified-send.service.ts`

1.  Idempotency claim via `IdempotencyService.claim(tenantId, key)`; `done` returns stored response, `inflight` throws `DUPLICATE_RESOURCE`; on success stores `complete(..., messageId, response)`, on error `abandon(...)`.
2.  Computes `sendOrder`: requested channels + optional fallback list (deduped). Reads tenant storage policy (`NotificationStorageService.getStoragePolicy`) to decide body/metadata persistence.
3.  Resolves recipients/addresses with `resolve-address.ts`:

- `email->email`, `sms->phone`, `push->deviceToken|userId|id`, `whatsapp->whatsappNumber|phone`, `in_app->userId|id`, `chat` via provider-specific fields (`slackChannel|slackWebhookUrl|chatAddress`, `discordWebhookUrl|chatAddress`, `telegramChatId|chatAddress`), `webhook|voice->id`.

4.  **Fallback mode** (`dto.fallback === true` or array): per recipient, finds first addressable channel in `sendOrder`; enqueues only primary delivery now and stores remaining addressable channels as `delivery.metadata.fallbackChain` (sequential rollover on terminal failure). **Non-fallback mode**: fan-out in parallel per channel/recipient for all addressable targets; unaddressable channels recorded as failed summaries.
5.  Persists `Message` (`status = PENDING` if future schedule else `PROCESSING`, stores subject/data/variables according to storage policy, metadata includes `projectId/storagePolicy/brandId/chatProvider`).
6.  Persists `MessageDelivery[]` (`status=PENDING`, `providerId='pending'`, per-delivery metadata: `projectId/templateId/templateData/chatProvider/subscriberId/priority/fallbackChain?`).
7.  Enqueues one notification job: `NotificationQueueService.addNotificationJob(message.id, tenantId, priority, scheduledAt|now, 0, payload{subject,data,templateId,variables,brandId,storagePolicy,chatProvider})`.
8.  Returns `{ messageId, status: 'queued', deliveries: [...] }` (channel-level summaries; failed address resolution surfaced per channel).

### B. Public alias `POST /messages` (Resend-style)

- **Controller**: `messaging/messages.controller.ts` (`ApiKeyAuthGuard`)
- For each recipient, calls `NotificationEngineService.send(...)` directly (not unified queue fan-out) with `channel`, `to`, `title=subject`, `message=html|text`, template/chatProvider/metadata.
- Returns aggregate over per-recipient engine results (`id/trackingId`, statuses). No idempotency handling shown.

### C. Simple notifications API `POST /notifications`, `POST /notifications/bulk`, `GET /notifications/:id/status`

- **Controller/Service**: `messaging/notification.controller.ts`, `messaging/notification.service.ts`
- Maps `NotificationRequestDto` to `NotificationEngineRequest` (requires tenant-bound API key, supported engine channel, `message` or `template`, and `chatProvider` for chat).
- `sendBulkNotifications` iterates sequentially with per-item try/catch.
- Status reads from `NotificationLog` and maps log status to response DTO.

### D. Transport SDK ingest endpoints

- **Controller**: `notifications/controllers/notification-transport.controller.ts` (`/notifications`, `ApiKeyAuthGuard`)
- `GET /notifications/ingest` (ntfy-style): requires `message|text|body` and `topic|to`; parses `data` JSON, priority/tags/scheduledAt/expiresAt; calls `NotificationEngineService.send(...)` with `channel` default `push`, `to = to ?? topic`, `subscriberId = to ?? topic`, `metadata.source='ingest'`.
- `POST /notifications/send` -> `UnifiedSendService.send(...)` (idempotency via `x-idempotency-key`).
- `POST /notifications/send/bulk` -> `Promise.all` over `UnifiedSendService.send(...)` per item, capturing failures into results; returns `batchId`.
- `GET /notifications/status/:trackingId` -> `NotificationTransportService.getDeliveryStatus` filtered by `apiKey.tenantId`.
- `GET /notifications/analytics` -> `NotificationTransportService.getAnalytics(...)`.
- **Module wiring**: `notifications/notifications.module.ts` provides `UnifiedSendService`, `NotificationEngineService`, `NotificationStorageService`, `NotificationTransportService`, `NotificationCenterService`, `NotificationGateway`, `WebPushSubscriptionService`; imports messaging entities/queue/idempotency/preferences/topics/quotas/provider/api-key/tenant-member/auth modules.

### E. Inbound email ingestion

- **Controller**: `notifications/transport/inbound-email/email-inbound.controller.ts` (`POST /notifications/inbound`, `@Public`)
- Requires server-side `INBOUND_EMAIL_SECRET` (503 if missing); ignores body-supplied `tokenSecret`.
- Validates `epochMs` (TTL 24h, skew 5m), verifies HMAC-SHA256 over `${tenantId}:${messageId}:${threadId}:${epochMs}` with timing-safe compare.
- Consent check for sender (`ConsentService.checkConsent`, `EMAIL`): if suppressed, calls `ConsentService.suppress(...)` and returns `{status:'suppressed'}`.
- Upserts inbound item into notification center (`NotificationCenterService.upsertInboundItem`) with thread/message/expiry (default 30d retention). This is an inbox-ingest path, not the outbound message queue pipeline.

---

## 2) Notification engine and storage policy

### A. Immediate/scheduled engine send

- **`NotificationEngineService`**: `notifications/engine/notification-engine.service.ts`

1.  Ensures `trackingId`; loads tenant storage policy.
2.  If `scheduledAt` in future -> `enqueueScheduledSend(...)` (persists `Message` as `PENDING`, schedules queue job, optionally creates tracking `NotificationLog`, returns `queued`).
3.  Runs consent check (`ConsentService.checkConsent`) for `tenantId/address=subscriberId|to/channel/priority`:

- `quiet_hours` -> reschedules via `enqueueScheduledSend` at `verdict.resumeAt`.
- other deny reasons handled after context persistence as failed/skipped result.

4.  Burst/quota check for immediate sends only: `ProjectQuotaService.checkQuota({tenantId,projectId})`.
5.  Persists send context via `NotificationStorageService.persistSendContext(...)` (creates `Message` + `MessageDelivery` + `NotificationLog` depending on policy and `skipMessageRecord` not set).
6.  Delivery execution: if denied -> synthetic failed (`Skipped: reason|project_quota`), else `deliver(request)` by channel.
7.  Persists outcomes to delivery/log (`updateDeliveryOutcome`) and updates message status (`FAILED` or `DELIVERED` for this single-send context).
8.  If `EPHEMERAL`, finalizes by clearing body/vars and deleting log (`finalizeEphemeral`).
9.  Returns `NotificationEngineResponse` (`id/trackingId/messageId/deliveryId/status/externalId/error/timestamp`).

- **Channel delivery in engine**:
- **Email**: escapes text to basic HTML and calls `ProviderOrchestratorService.sendEmail`.
- **SMS**: `sendSMS`.
- **Push**: builds rich payload from metadata (`badge/sound/category/actions/deepLink/android/ios/tags/threadId/imageUrl/ttl/collapseKey`). If `to` looks like device token (`ExponentPushToken`, long hex/token heuristic), sends directly. Else if `metadata.topic` present, fans out to topic subscribers (`TopicsService.listSubscribers`) via `SmartPushRouterService.routePushNotification` and sends per routing plan; aggregates failures/sent and sets provider from first plan.
- **WhatsApp**: `ProviderOrchestratorService.sendChatMessage(..., 'whatsapp')`.
- **Chat**: `sendChatMessage(..., request.chatProvider ?? 'slack')`, passes blocks/embeds from variables.
- **Webhook**: requires safe URL (`assertSafeWebhookUrl`), `fetch` POST JSON with 30s timeout, `redirect:"error"`; returns `webhook_<timestamp>` external id on 2xx.
- **In-app**: `sendInAppNotification` with persistence flag derived from storage policy (`FULL` => persistent).
- **Voice**: `sendVoiceCall` via orchestrator (Telnyx path).

### B. Queue-time delivery executor (separate implementation)

- **`DeliveryExecutorService`**: `notifications/engine/delivery-executor.service.ts`
- Used by queue processors for per-`MessageDelivery` execution.
- Supports `EMAIL/SMS/PUSH/WHATSAPP/CHAT/WEBHOOK/IN_APP`; default failure for other channels.
- Maps provider outcomes via `toOutcome(...)` and preserves `retryable`.
- Differences vs engine: push is direct token send only (no topic fan-out/smart routing/rich-payload shaping), webhook requires `webhookUrl` in input/metadata and does not use `assertSafeWebhookUrl`/timeout options shown in engine variant? (it does call `assertSafeWebhookUrl` and 30s timeout here too), in-app passes `messageId/deliveryId` and persistent based on `templateData.storagePolicy`, chat provider defaults to metadata `chatProvider` or slack.
- **No voice branch** here despite engine supporting voice.

### C. Storage and retention model

- **`NotificationStorageService`**: `notifications/storage/notification-storage.service.ts`
- Policy source: `TenantSettings.notificationStoragePolicy` (default `METADATA_ONLY`).
- Retention getters: content days from `contentRetentionDays` or `retentionPolicy.notificationContentRetentionDays` (default 90); metadata days from retention policy/logs retention.
- `persistSendContext`: for non-ephemeral metadata paths creates `NotificationLog` (`queued`, carries template/priority/messageId/deliveryId in metadata); creates `Message`/`MessageDelivery` unless `skipMessageRecord`; body/subject/variables persisted only when `FULL`.
- `updateDeliveryOutcome`: updates `MessageDelivery` status/timestamps/provider ids/errors and `NotificationLog` status/timestamps/externalId/error.
- `finalizeEphemeral`: clears message `data/subject/variables` and deletes log.
- `buildExpiresAt` exists but not used in shown flow.
- **`NotificationLog`**: `notifications/entities/notification-log.entity.ts` — tracking/status/timestamps/error/externalId + metadata (`templateId,priority,retryCount,webhookUrl,messageId,deliveryId`).
- **`Message` `MessageDelivery`**: `messaging/message.entity.ts`, `messaging/message-delivery.entity.ts`
- `Message`: tenant-scoped aggregate (channels, recipients, template/vars, subject/data, status/priority/schedule/retries/error, metadata, deliveries relation).
- `MessageDelivery`: per-channel/per-recipient row (provider ids/response/error/retryCount, lifecycle timestamps, `SKIPPED` status, metadata including fallback chain/subscriber/project context).

---

## 3) BullMQ queues, processors, and failure handling

### Queue topology

- **Constants**: `messaging/queue/notification-queue.constants.ts` defines `notification-queue`, `notification-delivery-queue`, `notification-admin-queue`.
- **Registration**:
- `messaging/queue/notification-queue.module.ts` registers all three queues (default attempts/backoff/removeOnComplete/removeOnFail), imports messaging entities/template/provider/preferences/idempotency/quotas/delivery-events, provides `NotificationQueueService`, `NotificationProcessor`, `DeliveryProcessor`, `DeliveryExecutorService`.
- `messaging/queue/notification-queue-core.module.ts` also defines/registers the same queue names and provides `NotificationQueueService` (lighter core module). Both coexist; constants duplicated in core module.
- **Service**: `messaging/queue/notification-queue.service.ts`
- Job payloads: `NotificationJobData` (message-level, optional payload snapshot), `DeliveryJobData`, `DeadLetterJobData`, `AlertJobData`.
- `addNotificationJob`: job `process-notification`, priority mapped from `MessagePriority`, delay from `scheduledAt`, attempts 3 exp backoff 2s, stable `jobId = msg-${notificationId}-${retryCount}`.
- `addDeliveryJob`/`addBulkDeliveryJobs`: `process-delivery`, attempts 5 exp backoff 1s, bulk adds 20ms stagger.
- `rescheduleNotificationJob`: removes matching waiting/delayed/prioritized jobs by scanning queue jobs and re-adds at new time or immediately.
- Admin/DLQ helpers: `addToDeadLetterQueue`/`addAlertJob` target `NOTIFICATION_ADMIN_QUEUE`; `getDeadLetterItems`/`reprocessDeadLetterItem` read/requeue admin jobs (note: processor-persisted DLQ is also stored in DB by `DeadLetterProcessor`, so two representations exist).
- Queue ops: stats/pause/resume/clean/getFailedJobs.

### Notification processor (`notification.processor.ts`, `@Processor(NOTIFICATION_QUEUE)`)

- Handles `process-notification`, `handle-failed-notification`, `retry-notification`; `handle-dead-letter|process-alert` redirected to admin queue.
- **`processNotification`**:

1.  Loads `Message` (+deliveries), marks `PROCESSING`.
2.  If no deliveries, materializes them via `createDeliveryRecords(...)` (uses `resolveAddress`; may fall back to single-recipient `metadata.to`; creates `PENDING` deliveries with `providerId='pending'`).
3.  Renders template if `templateId` (`TemplateService.render`), falling back to payload/message subject/data on render error.
4.  Builds per-delivery jobs carrying rendered content/template/vars/brand/storagePolicy/metadata/chatProvider and bulk-enqueues to delivery queue (priority normal, attempts 5, stagger 20ms).
5.  If zero deliverable jobs, marks message `FAILED` (`No recipient address available for any channel`).

- **`processDelivery`** (invoked by delivery worker):

1.  Idempotency/duplicate guard: if delivery already `SENT|DELIVERED`, returns without re-sending.
2.  Consent gate (`ConsentService.checkConsent`): `quiet_hours` -> requeue same delivery job with `delayMs`; suppressed/preference -> mark delivery `SKIPPED`, update aggregate message status, return.
3.  Quota gate (`ProjectQuotaService.checkQuota(..., excludeDeliveryId)`): on deny mark `SKIPPED` (`project_quota`).
4.  Executes via `DeliveryExecutorService.deliver(...)`.
5.  Records delivery event (`DeliveryEventService.record`, `SENT` or `DROPPED/provider_failed` with providerMessageId/reason).
6.  On failure: throws `UnrecoverableError` for non-retryable outcomes else `Error` (BullMQ retry). On success: marks delivery `DELIVERED` with sent/delivered timestamps/provider ids and updates aggregate status.
7.  Catch/final attempt: persists failed delivery state (`FAILED`, error, retryCount), updates aggregate message status; if terminal and delivery exists, attempts `enqueueChannelFallback(...)`.

- **Channel fallback rollover (`enqueueChannelFallback`)**:
- Reads `delivery.metadata.fallbackChain`, resolves subscriber/recipient and next addressable channel (`resolveAddress`), creates a new `PENDING` `MessageDelivery` carrying remaining chain, enqueues `process-delivery` for it, updates aggregate status. If no chain/addressable fallback, no rollover.
- **Aggregate status projection**: `updateNotificationStatusFromDeliveries` sets message `DELIVERED` (all delivered), `SENT` (some delivered/sent), `FAILED` (all failed/skipped/unsubscribed), else `PROCESSING`.
- **Terminal failure handling**:
- `@OnWorkerEvent("failed")` on `process-notification` (final attempt only) enqueues `handle-failed-notification`.
- `handleFailedNotification`: marks message `FAILED`, adds dead-letter/admin job payload, sends system alert (`system_alert` job) with severity/recipients logic.
- `handleFailedDelivery`: marks delivery `FAILED`, updates aggregate status, adds dead-letter/admin job, conditionally alerts by priority/channel/retry thresholds.
- `retryNotification`/`retryDelivery` implement manual delayed requeue with jitter (in addition to BullMQ built-in attempts/backoff).
- **Dead-letter processing**: `messaging/queue/dead-letter.processor.ts` (`@Processor(NOTIFICATION_ADMIN_QUEUE)`)
- `handle-dead-letter`: persists to `DeadLetter` repository/entity (`PENDING_REVIEW`, metadata), creates critical alert when `retryCount >= 3`, notifies admins via `AuthEmailService` (HTML/text).
- `process-alert`: dispatches email (and logs SMS path as disabled in code) and stores `SystemAlert`.
- **Delivery worker**: `messaging/queue/delivery.processor.ts` (`@Processor(NOTIFICATION_DELIVERY_QUEUE)`) delegates to `NotificationProcessor.processDelivery/handleFailedDelivery/retryDelivery`; on final failed `process-delivery`, enqueues `handle-failed-delivery`.

---

## 4) Provider/BYOP orchestration, adapters, and webhooks

### Provider resolution and send execution

- **Primary orchestrator**: `provider/provider-orchestrator.service.ts`
- Maintains registered provider instances/factories for email/chat/push/sms; registers SMS with `SMSRoutingService`.
- **BYOP vs managed**: `resolveManagedProvider` looks up active tenant+channel configs (`ProviderConfigRepository.findActiveByTenantAndChannel`), decrypts (`ProviderEncryptionService`), validates provider config, and returns `mode:'byo'` when valid; otherwise `null` (managed path). Provider name normalization aliases include `aws_ses -> ses`, `whatsapp_business -> whatsapp`.
- **Managed chains**: email `['zeptomail','mailgun','sendgrid']`; push `['fcm','apple-push','expo-push']` (SNS/SES noted as BYOP-only in comments for those channels/categories); SMS chain derived from `SMSRoutingService.getPreferredProviders(...)`.
- **Reliability wrapper**: `attemptManagedChain`/`attemptByopSend` execute under `CircuitBreakerService`; provider-reported retryable failures throw `ProviderOutcomeFailure` inside breaker to record failure, permanent failures (`retryable:false`) do not open circuit; failed push token pruning via `DeviceRegistrationService.pruneInvalidTokens` on outcomes carrying `failedTokens`.
- **Billing**: on successful sends charges via `BillingIntegrationService.processNotificationTokenUsage(...)` (billing mode `byo|managed`, channel-specific; bulk SMS scales by recipient count; voice charges with metadata). Billing failures are logged and rethrown.
- **Channel specifics**:
- Email: can enrich payload with brand config/default from (`BrandMessagingConfigService`).
- Chat/WhatsApp: BYOP-only by design (no platform fallback), throws `BadRequestException` if no tenant connection; `testChatConnection` bypasses billing/circuit and can do verify-only when adapter exposes `verifyCredentials`.
- Push: enhances with brand config; BYOP single-provider send or managed chain fallback.
- SMS: BYOP or country/routing-preferred managed chain (single and bulk).
- Voice: Telnyx outbound call via `VoiceService`, wrapped in circuit, charges as managed voice.
- In-app: internal DB write via `InAppOrchestratorService` (no circuit breaker), charged as managed.
- Also exposes `sendToRoom`, `sendCallNotification`, provider listing, in-app status, phone validation.

- **Provider config model**: `provider/provider-config.entity.ts`
- `provider_configs`: scoped to `projectId` (tenant derived via project relation), stores `providerId/name/type/channel/config(json)/priority/isActive/isDefault/supportedCountries/rateLimits/metadata`, unique `(projectId, providerId, channel)`.
- Supports multiple channel/provider types including email/chat/whatsapp/sms/push/custom.

- **Alternate/ provider subsystem**: `provider/provider.service.ts`
- Separate DI service with repository/factory/performance tracker/config validator/encryption/Redis-backed in-process circuit breaker map.
- Provides generic `send/sendBulk/selectProviders`, config CRUD/activation/metrics, healthy-provider filtering (`PROVIDER_MIN_SUCCESS_RATE`), instance caching.
- Bulk batching defaults to `PROVIDER_BULK_BATCH_SIZE` (250) but `voice` batches at 10.
- Tenant scoping in queries mixes project/tenant joins and direct `tenantId` in some updates/toggles; this service appears parallel to `ProviderOrchestratorService` rather than the unified queue/engine path above.

### Provider webhook ingestion (email delivery feedback)

- **`provider/controllers/email-webhook.controller.ts`** (`/webhooks/email`, public, unthrottled)
- **SendGrid/Mailgun/Resend**: tenant-scoped routes (`/:tenantId`) resolve per-tenant signing key from active BYOP email provider config (`webhookPublicKey` or `webhookSecret`), verify signatures via `WebhookValidatorService`; reject with 401 on invalid/missing key.
- **SES**: `/ses` verifies SNS envelope certificate/signature (`SnsMessageVerifierService`), handles subscription confirmation, parses SNS message JSON.
- Normalizes provider payloads (`email-event-normalizer`) and ingests via `DeliveryEventService.ingestProviderFeedback`.
- **`DeliveryEventService`**: `messaging/events/delivery-event.service.ts`
- Correlates feedback by `providerMessageId` -> `MessageDelivery`; records idempotent `DeliveryEvent` rows (dedup on provider event id unique constraint) and projects latest state onto `MessageDelivery` (`delivered/opened/clicked/bounced/unsubscribed/dropped`).
- Terminal projection protection: bounce/unsubscribe not overwritten by later delivered/opened/clicked.
- Auto-suppresses address on hard bounce complaint unsubscribe via `ConsentService.suppress`.

---

## 5) Templates, campaigns, workflows

### Templates

- **`template/template.service.ts`** (TypeORM `Template` + `TemplateVersion`)
- CRUD/list with tenant (and some project) scoping, slug uniqueness, cache invalidation.
- Rendering: `render` compiles Handlebars from active template or specified version (`subject/data/htmlContent`), with fallback returning source on compile error.
- Validation helpers: structural checks and variable-presence checks against provided data.
- Supports versioning/activation/archive/duplication via service collaborators; queue processors and engine resolve templates by `templateId`/tenant during send/render.

### Campaigns

- **`campaign/campaign.service.ts`** (persisted `Campaign` entity)
- CRUD + dispatch orchestration over `TopicsService` and `UnifiedSendService`.
- **Audience resolution seam** (`audienceResolvers`): `topic`, `topics` (union of subscribers), `list/subscribers` (explicit ids/addresses), `subscriber/single`, `trigger/event` (requires runtime subscriber ids), rejects unsafe `all`.
- **Message resolution**: picks template/content from `templates[step|0]` (+ campaign variables/metadata).
- **Dispatch**: resolves channels, audience, schedule, sends per subscriber in chunks (50) via `UnifiedSendService.send(..., tenantId)`; tracks queued/failed, updates status/analytics/step/next run.
- **Types/policies**: `one_time/triggered` complete; `recurring` reschedules via interval (`everyMs/everyMinutes/everyHours`) into `schedule.nextRunAt`; `drip` advances steps using template delay fields.
- **Automation**: `@OnEvent('campaign.trigger')` dispatches matching active triggered campaigns (event/trigger scoping rules apply); `@Cron(EVERY_MINUTE)` `processDueCampaigns()` dispatches due recurring/drip campaigns.
- Campaign state/analytics persisted on entity; no separate campaign queue shown (fan-out occurs synchronously in service calls to unified send, which itself queues).

### Workflows

- **`workflow/workflow.service.ts`** (persisted `Workflow`/`WorkflowRun`)
- CRUD for workflow definitions; run lifecycle: `startRun`, `listRuns/getRun/cancelRun`, `signal` for `waiting_for_event` runs and optional auto-start of `event`-triggered active workflows.
- **Engine model**: step interpreter with cursor `currentStep`, bounded per-tick execution (`MAX_STEPS_PER_TICK`), persisted context and wait state.
- **Step handlers**: `set` (merge context), `condition/branch` (compare context key -> jump/next), `delay/wait` (park until `waitUntil`), `wait_for_event` (park with optional timeout), `send` (dispatch via `UnifiedSendService.send` to resolved channels/address/template/content).
- **Send integration**: resolves simple `{{key}}` placeholders from run context; requires `to` + valid channels + template/content; injects workflow metadata/ids into variables/metadata.
- **Retries/timeouts**: send-step retry policy parks run with backoff and retries same step; `@Cron(EVERY_MINUTE)` resumes due waits, fails timed-out event waits, and advances delayed/retry runs.
- Workflow run status transitions: `running/waiting/waiting_for_event/completed/failed/cancelled`.

---

## 6) Preferences, suppressions, quiet hours, topics, inboxes

### Preferences and consent enforcement

- **`preferences/preferences.service.ts`**
- Channel preference map per subscriber (`NotificationPreference`, defaults all channels enabled if unset), quiet-hours CRUD, suppression list/add/remove (address normalized/lowercased, channel-specific or global), and subscriber erasure delegation to `SubscriberErasureService` (GDPR/right-to-erasure seam).
- **`preferences/consent.service.ts`** (`checkConsent`)
- Order/effects: suppression (address + optional channel/global) -> channel preference disabled -> enabled quiet hours for subscriber (`subscriberId` defaults to address).
- Quiet-hours: uses `localMinuteOfDay/isInQuietHours/minutesUntilQuietEnds`; `urgent` priority bypasses deferral; otherwise returns `allowed:false, reason:'quiet_hours', deferred:true, delayMs/resumeAt`.
- `suppress/unsuppress` manage `NotificationSuppression` rows (idempotent insert behavior shown).
- **Enforcement points**:
- **Engine immediate send** (`NotificationEngineService.send`): defers quiet-hours by scheduling; other denials become skipped/failed outcomes.
- **Queue delivery execution** (`NotificationProcessor.processDelivery`): rechecks consent per delivery; defers quiet-hours by re-enqueueing delivery job with delay; marks suppressed/preference as `SKIPPED`.
- **Inbound email** (`EmailInboundController`): suppress verdict triggers suppression record and drops ingest.
- **Provider feedback** (`DeliveryEventService.ingestProviderFeedback`): hard bounce/complaint/unsubscribe auto-suppress address.

### Topics

- **`topics/topics.service.ts`**
- Topic ensure/subscribe/unsubscribe/list subscribers; `eraseSubscriber` removes subscriber from all tenant topics.
- Used by: engine push topic fan-out (`metadata.topic`), campaign audience resolution (`topic/topics`).

### Inboxes in-app

- **In-app feed service**: `in-app/services/in-app-feed.service.ts` over `InAppNotification`
- Feed query (tenant/subscriber/feed, seen/read/archived filters, pagination + unseen/unread counts), mark seen/read/archived/all, and `deleteBySubscriber` via shared `eraseInboxBySubscriber`.
- **In-app module**: `in-app/in-app.module.ts` wires feed service, inbox controller, gateway, JWT/auth/tenant-member deps.
- **Notification center/inbox seams** (partially observed): `notifications/services/notification-center.service.ts` used by inbound email and center controller; `notifications/services/inbox-erase.ts` shared erase helper; gateway/transport/center controllers registered in `notifications.module.ts`. In-app delivery execution ultimately routes through `ProviderOrchestratorService.sendInAppNotification -> InAppOrchestratorService`.

---

## 7) Delivery/log tracking and observability surfaces

- **Primary persisted records**:
- `Message` (`messaging/message.entity.ts`): send request/aggregate lifecycle.
- `MessageDelivery` (`messaging/message-delivery.entity.ts`): per-recipient/channel attempt state, provider ids/response/errors/timestamps/retries/metadata.
- `NotificationLog` (`notifications/entities/notification-log.entity.ts`): tracking/status timeline metadata for transport/engine flows and dashboard/log queries.
- `DeliveryEvent` (`messaging/entities/delivery-event.entity.ts`, via `DeliveryEventService`): append-only provider/internal event log with idempotent provider-event handling and projection to `MessageDelivery`.
- `DeadLetter` `SystemAlert` entities (persisted by `DeadLetterProcessor`), plus admin-queue jobs.
- **Event projection/feedback**: `DeliveryEventService` records queue send/drop outcomes and ingests normalized provider webhooks; updates delivery projection and consent suppression on terminal negative signals.
- **Query/read paths**:
- `MessagingService.getTenantMessages/getDeliveryStats/getMessageDetail` operate on `NotificationLog` (+ linked `Message`/`MessageDelivery`) using `message-log.query.ts`.
- Transport status/analytics endpoints go through `NotificationTransportService`.
- Queue inspection/reprocessing APIs implied by `NotificationQueueService` (`getQueueStats/getFailedJobs/getDeadLetterItems/reprocessDeadLetterItem`) and dead-letter controller/module present in tree.

---

## 8) End-to-end control/data paths (condensed)

1. **Ingress** (`/messaging/send`, `/notifications/send`, `/messages`, `/notifications`, `/notifications/ingest`, campaigns/workflows/internal callers)
2. **Normalize + scope** (tenant/project/auth, recipient/address resolution, template/vars/content, storage policy)
3. **Consent/quota gates** (engine immediate path and/or queue delivery path; quiet-hours defer, suppress/preference/quota skip/fail paths)
4. **Persist context** (`Message`, `MessageDelivery`, `NotificationLog` depending on path/policy)
5. **Enqueue** (BullMQ `notification-queue` -> `notification-delivery-queue`; admin/DLQ to `notification-admin-queue`)
6. **Execute delivery** (`DeliveryExecutorService` or engine direct deliver) -> `ProviderOrchestratorService` (BYOP/managed chain, circuit breaker, branding/routing, billing) -> channel adapter/provider
7. **Record outcome** (delivery/log/message status updates, `DeliveryEvent` append/projection)
8. **Feedback/async updates** (provider webhooks -> normalized `DeliveryEvent` ingestion -> delivery projection + suppression; inbound email -> signed ingest -> notification center)
9. **Automation** (campaign cron/event dispatch, workflow cron/event stepping) -> back to unified/engine send paths

---

## 9) Failure and erasure touchpoints

### Failure handling

- **Input/idempotency**: duplicate inflight idempotency key rejected; completed key returns stored response (`UnifiedSendService`).
- **Addressability**: unresolved recipients/channels surfaced as failed delivery summaries; zero-delivery notifications fail fast or mark message failed.
- **Queue retries/backoff**: notification jobs attempts 3, delivery jobs attempts 5 (exp backoff), plus explicit retry helpers and terminal-failure event handlers.
- **Provider failures**: orchestrator distinguishes retryable vs permanent outcomes, records circuit-breaker state, falls through managed chains; BYOP send failures returned/propagated with circuit accounting.
- **Consent/quota blocks**: quiet-hours deferred; preference/suppression/quota produce skipped/failed outcomes at engine or per-delivery level.
- **DLQ/admin**: exhausted jobs routed to admin handling, persisted in `DeadLetter`/`SystemAlert` records and alert notifications; admin queue jobs can be reprocessed.
- **Webhook/ingest safety**: provider webhook signature/certificate verification (`email-webhook.controller.ts`, inbound email HMAC/timestamp checks), safe URL enforcement for outbound webhooks in engine/executor.
- **Scheduled/edit/cancel constraints**: message cancel/edit limited to `PENDING`; reschedule moves delayed queue job.

### Erasure privacy touchpoints

- **Subscriber erasure API seam**: `PreferencesService.eraseSubscriberData` delegates to `SubscriberErasureService` (per-store delete/redact implementation not shown here).
- **Topics**: `TopicsService.eraseSubscriber(tenantId, subscriberId)` deletes tenant-scoped topic subscriptions.
- **In-app inbox**: `InAppFeedService.deleteBySubscriber` notification-center inbox erase use shared `eraseInboxBySubscriber` helper (identity match across `subscriber_id/user_id`).
- **Suppressions/preferences/quiet-hours**: persisted per tenant/subscriber or address and removable via preferences APIs; provider negative feedback can auto-create suppressions.
- **Retention/storage controls**: tenant `notificationStoragePolicy` and retention settings govern body/metadata persistence and ephemeral finalization (`NotificationStorageService`).
- **Note**: inbound email upsert into notification center and general `Message/MessageDelivery/NotificationLog/DeliveryEvent` retention/erasure behavior beyond exposed seams requires checking `SubscriberErasureService`, `NotificationCenterService`, and retention jobs/entities not fully read here.

---

## 10) Observed correctness/stability issues and scoped fix/refactor opportunities

(grounded in inspected files; no files modified)

1. **Multiple overlapping send pipelines with behavior drift**: `/messaging/send` -> `MessagingService/UnifiedSendService` (queue fan-out, idempotency, fallback chains), `/messages` and `/notifications` -> `NotificationEngineService`/`NotificationService` (direct engine, different tracking/persistence semantics), and `MessagingService.processMessage(...)` implements yet another direct-send loop. This increases inconsistency in consent/quota/storage/fallback/delivery-record behavior.

- _Scoped refactor_: converge all send ingress paths on one orchestration path (unified queue for async/multi-recipient or a single engine contract with explicit mode), and deprecate/adapt `processMessage` to reuse it.

2. **Delivery execution logic duplicated and not fully equivalent**: `NotificationEngineService.deliver(...)` and `DeliveryExecutorService.deliver(...)` both implement channel sends but differ materially (e.g. push topic fan-out/smart routing/rich payload shaping and voice support exist in engine; executor lacks them and is what queue deliveries use). Queue-processed deliveries can therefore behave differently from immediate/alias sends.

- _Scoped refactor_: extract a single channel-delivery component used by both immediate and queued paths; add parity tests for push-topic, rich push metadata, webhook policy, and voice.

3. **Queue module/constants duplication**: `notification-queue.constants.ts`, `notification-queue.module.ts` exports, and `notification-queue-core.module.ts` (redeclares same queue names and registers queues/provides `NotificationQueueService`) coexist. Risk of divergent configuration/wiring or accidental double registration/import confusion.

- _Scoped refactor_: make `notification-queue-core.module.ts` the sole queue-definition source and have higher-level modules import/re-export it.

4. **Two provider orchestration abstractions in parallel**: `ProviderOrchestratorService` (used by engine/queue/in-app/voice/billing/circuit-breaker service) and `ProviderService` (factory/performance-tracker/Redis circuit breaker/config CRUD/bulk send) both exist with different selection/health/caching models.

- _Scoped refactor_: clarify ownership (single runtime send orchestrator) and isolate config-management/performance concerns; remove or fence unused runtime paths to avoid stale behavior.

5. **Dead-letter representation split**: `NotificationQueueService` stores DLQ items as jobs in admin queue and exposes reprocess over those jobs, while `DeadLetterProcessor` persists dead letters/alerts into DB entities. Operational tooling may see incomplete state depending on which source it queries.

- _Scoped fix_: define one source of truth (DB entity + job linkage) and align list/reprocess/admin endpoints to it.

6. **Inconsistent direct-fetch timeout/SSRF hardening symmetry**: outbound webhook delivery enforces safe URL and timeout in engine/executor (good), but other external call sites were not exhaustively audited here; ensure all HTTP egress paths (including any provider adapters not read) use the same policy.

- _Scoped audit/fix_: centralize outbound HTTP helper with URL validation, timeout, redirect policy, and bounded response handling.

7. **Status semantics differ by source**: log list/detail APIs are `NotificationLog`-centric while queue/engine also mutate `Message`/`MessageDelivery`; `MessageDeliveryStatus.SKIPPED` and consent/quota outcomes may not be uniformly represented to clients across endpoints (`/messages` vs `/messaging` vs transport status).

- _Scoped refactor_: define canonical delivery state projection and map all read APIs from it.

8. **Potential resilience gaps in batch/dispatch loops**: `MessagingService.sendBulkMessages` and campaign dispatch do per-item awaits/chunked `Promise.allSettled` with logging but no rate limiting/backpressure beyond chunk size and no partial-failure persistence contract beyond response; very large campaigns/workflow fan-outs run in-process.

- _Scoped improvement_: move large fan-out to queued/batched jobs with progress tracking and idempotent per-recipient dispatch keys.

9. **Webhook key/config lookup depends on decrypted provider config fields**: email webhook verification resolves `webhookPublicKey/webhookSecret` from active BYOP config by provider id; misconfiguration yields 401 at runtime (correct) but operational discoverability/rotation UX may be weak.

- _Scoped improvement_: explicit validation/health checks for required webhook secrets when configuring BYOP providers.

10. **Documentation/config drift already noted in repo docs is consistent with code shape**: AGENTS/known docs mention messaging/queue/consent/suppression drift; code shows real queue/suppression/consent machinery exists, but behavior is spread across multiple modules/paths. Any future changes should treat `messaging/*`, `notifications/engine/*`, and queue processors as one contract.

**Navigation hints**

- Start at ingress: `messaging/messaging.controller.ts`, `notifications/controllers/notification-transport.controller.ts`, `messaging/messages.controller.ts`.
- Follow queued path: `messaging/unified-send.service.ts` -> `messaging/queue/notification-queue.service.ts` -> `messaging/queue/notification.processor.ts` + `delivery.processor.ts` -> `notifications/engine/delivery-executor.service.ts` -> `provider/provider-orchestrator.service.ts`.
- Follow immediate engine path: `notifications/engine/notification-engine.service.ts` (+ `notifications/storage/notification-storage.service.ts`).
- Follow feedback/consent: `provider/controllers/email-webhook.controller.ts` -> `messaging/events/delivery-event.service.ts` -> `preferences/consent.service.ts`.
- Follow automation: `campaign/campaign.service.ts`, `workflow/workflow.service.ts` (both call `UnifiedSendService`).
