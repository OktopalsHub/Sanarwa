# [007] Data model and persistence

- **Label:** `wayfinder:research`
- **Status:** closed (resolved)
- **Parent map:** [Whole-repo understanding map](../MAP-001-whole-repo-understanding.md)
- **Blocked by:** none (informed by [003])
- **Blocks:** none (informs fog graduation)

## Question

What is the persistence model of Sanarwa — TypeORM entities and migrations, tenant/project scoping, key aggregates and relationships (messages/deliveries/logs/inbox, campaigns/workflows, tokens/billing, providers/config, preferences/topics), Redis usage, and lifecycle/retention/erasure behavior — stated clearly enough to reason about data correctness and change impact? If understanding reveals concrete correctness/stability issues, scoped fixes, refactors, or migrations may be included.

## Resolution

# Ticket [007] — Sanarwa persistence model (medium-thoroughness research)

Grounded in repository files under `/home/daniel/Documents/projects/sanarwa` (read-only). **No files modified.**

## 1) Persistence stack and runtime wiring

### Database / ORM

- **ORM:** TypeORM 0.3-style `DataSource` with PostgreSQL.
  - `apps/api/src/common/database/data-source.ts:102-203`
  - `type: "postgres"`, `url: process.env.DATABASE_URL`, `synchronize: false`, `logging: isDev`, `migrationsRun: true`, `migrationsTransactionMode: "all"`, `namingStrategy: new SnakeNamingStrategy()`.
- **Entity registration:** explicit `entities: [...]` array in `data-source.ts` (not glob-discovered). Includes `User`, `Tenant`, tenant subentities, auth/org entities, messaging/log/inbox entities, provider/usage/device/push/whatsapp entities, billing/quota/webhook entities, `Workflow`, `WorkflowRun`, etc. (`data-source.ts:106-151`).
- **Migration registration:** explicit `migrations: [...]` array (`data-source.ts:152-195`). Migrations live in `apps/api/src/common/database/migrations/` and are re-exported via `apps/api/src/common/database/migrations/index.ts`.
- **Entities barrel:** `apps/api/src/common/database/entities/index.ts` exports a subset of entities (api-key/brand/invite/base, billing, notification-log, message/message-delivery, project, provider-config/usage/device, security-event, template, configuration*, tenant/member/user). It is **not** a complete mirror of the data-source entity list.

### Migration/state drift signals (observed)

- `glob` shows migration files present that are **not** in `dataSource.migrations` (e.g. `1788298445469-create-voice-calls.ts`, `1788298454986-add-inapp-feed-columns.ts`, `1791800000000-AddTopics.ts`, `TemplateVersioningColumns1791470100000.ts` appears in `migrations/index.ts` but not in `data-source.ts`). Conversely, `data-source.ts` imports classes not obviously matching every filename in the directory. Because `migrationsRun: true` runs only the registered array, **DB schema evolution can diverge from files on disk unless registration is kept in sync** (`data-source.ts`, `migrations/index.ts`).
- No separate migration CLI config inspected beyond this file; root `AGENTS.md` lists `pnpm --filter @sanarwa/api migration:*` scripts.

## 2) Base model and identity conventions

- **Abstract base:** `apps/api/src/common/database/entities/base.entity.ts`
  - `@PrimaryColumn("varchar", { length: 36 }) id`, app-generated via `@BeforeInsert` `randomUUID()` if missing.
  - `created_at`, `updated_at` timestamps.
- **Convention split:** some aggregates extend `BaseEntity` (`Tenant`, `Project`, `Campaign`, `Workflow`, `WorkflowRun`, `TenantSettings`, `Webhook`, etc.), while others define their own PK/timestamps (often `@PrimaryGeneratedColumn("uuid")`), e.g. `Message`, `MessageDelivery`, `DeliveryEvent`, `NotificationLog`, `InAppNotification`, `TokenBalance`, `TokenTransaction`, `Subscription`, `DeviceRegistration`, `ProviderUsageLog`, `ProviderConfig`, `Template`, preferences/topics/quota entities. **ID column type/strategy is therefore heterogeneous** (varchar(36) app-generated vs DB-generated uuid), which matters for FK compatibility, joins, and migrations.

## 3) Tenant/project scoping model

### Core hierarchy

- **Tenant (root org/account boundary):** `apps/api/src/modules/tenant/entities/tenant.entity.ts`
  - Table `tenants`, `@Unique(["subdomain"])`, indexed by `status`.
  - Fields: `name`, `subdomain`, `inviteCode`, `status`, `quotas: TenantQuotas` (json), `usage?: TenantUsage` (json), `lastActiveAt`, `deletedAt` (soft-delete column), `ownerId -> User`.
  - Relations: one-to-one `settings`, `billingInfo`; one-to-many `members`, `projects`, `invites`, `brands`, `templates`, `pushCertificates`, `webhooks`.
- **Project (product/app scope within tenant):** `apps/api/src/modules/project/entities/project.entity.ts`
  - Table `projects`, indexes on `tenantId`, `status`, unique `(tenantId, name)`.
  - Fields: `name`, `description`, `status`, `metadata`, `tenantId`.
  - Relations: `tenant`, optional `brand`, `createdBy` (TenantMember), one-to-many `apiKeys`, `providerConfigs`, `templates`, `pushCertificates`.
- **Tenant settings (policy/config):** `apps/api/src/modules/tenant/entities/tenant-settings.entity.ts`
  - 1:1 with tenant (`tenant_id`, cascade on delete from tenant side semantics).
  - Stores `notificationStoragePolicy`, `contentRetentionDays`, `customBranding`, `retentionPolicy` JSON (`logsRetentionDays`, `auditLogsRetentionDays`, `deletedDataRetentionDays`, `notificationContentRetentionDays`, `notificationMetadataRetentionDays`), timezone/language, toggles.

### Scoping patterns observed

- **Tenant-scoped rows:** most domain tables carry `tenant_id` (sometimes named `tenantId` in code) and index it, often with status/time for access patterns: `messages`, `in_app_notifications`, `notification_logs`, `delivery_events`, `workflows`, `workflow_runs`, `campaigns`, `topics`, `project_send_quotas`, preferences/suppressions/quiet-hours, billing entities, etc. (entity decorators and migrations grep in `apps/api/src/common/database/migrations/*`).
- **Project-scoped rows:** `provider_configs`, `api_keys` (per migration naming), templates can be tenant-level or project-linked (`template.projectId` nullable), push certificates/devices relate to project/tenant contexts in parts of the system.
- **Cross-entity derivation:** `ProviderConfig` computes `tenantId` via `project?.tenant.id` getter (no stored tenant FK column in entity), so tenant attribution depends on loaded relation graph (`apps/api/src/modules/provider/provider-config.entity.ts`).
- **Soft delete:** only `Tenant.deletedAt` seen explicitly among read entities; most other entities rely on hard deletes/cascades/retention jobs.

## 4) Key aggregates and relationships

### 4.1 Messaging, delivery, inbox, and operational logs

#### Message (send intent/request)

- `apps/api/src/modules/messaging/message.entity.ts` (`messages`)
  - Identity/scope: uuid PK, `tenantId` indexed.
  - Payload: `templateId?`, `channels[]`, `recipients: MessageRecipient[]` (JSON; supports email/phone/deviceToken/whatsapp/chat/webhook/userId metadata), `variables`, `subject?`, `data?`, `metadata?`.
  - State: `status` enum (`pending|processing|sent|delivered|partially_delivered|failed|cancelled`), `priority`, `scheduledAt`, `retryCount`, `errorMessage`, `deliveredAt`.
  - Relations: optional `createdBy -> TenantMember`, `deliveries -> MessageDelivery[]` (cascade).
  - Indexes: `(tenantId,status)`, `(tenantId,createdAt)`, `(scheduledAt)`.

#### MessageDelivery (per-channel/per-recipient attempt state)

- `apps/api/src/modules/messaging/message-delivery.entity.ts` (`message_deliveries`)
  - Scope/links: `messageId -> Message` (FK, `onDelete: CASCADE`), `tenantId`, `channel`, `providerId`, `recipient`, `providerMessageId?`, `providerResponse?`, `errorMessage?`, `retryCount`, timestamps `sentAt/deliveredAt/openedAt/clickedAt`.
  - Status enum: `pending|sent|delivered|failed|bounced|opened|clicked|unsubscribed|skipped`.
  - Indexes: `(messageId,status)`, `(channel,status)`, `(providerId,status)`, `(createdAt)`, plus column indexes on `messageId`, `tenantId`.

#### DeliveryEvent (provider event/audit stream)

- `apps/api/src/modules/messaging/entities/delivery-event.entity.ts` (`delivery_events`)
  - Immutable-style log row: uuid PK, `createdAt` only (no update timestamp/base entity).
  - Fields: `tenantId`, optional `messageId/deliveryId`, `channel`, `provider`, `type` (`DeliveryEventType`), `bounceType?`, `reasonCode?`, `diagnostic?`, `url?`, `userAgent?`, `ip?`, `providerEventId?`, `providerMessageId?`, `raw` jsonb, `occurredAt`.
  - Indexes: `(tenantId,messageId,occurredAt)`, `(tenantId,deliveryId,occurredAt)`, `(provider,providerMessageId)`, `(tenantId)`.

#### NotificationLog (tracking/operational log)

- `apps/api/src/modules/notifications/entities/notification-log.entity.ts` (`notification_logs`)
  - Fields: unique `trackingId`, `channel`, `to`, `status` (`queued|sent|delivered|failed|cancelled`), `tenantId`, `projectId`, `externalId?`, `error?`, schedule/send/delivery/fail timestamps, `metadata` jsonb (`templateId, priority, retryCount, webhookUrl, messageId, deliveryId`).
  - Indexes: `(tenantId,createdAt)`, `(trackingId)`, `(channel,status)`.
  - Not the same model as `Message`/`MessageDelivery`; overlaps conceptually for observability/tracking.

#### In-app inbox/notification center

- `apps/api/src/modules/messaging/entities/in-app-notification.entity.ts` (`in_app_notifications`)
  - Rich inbox record: `title`, `message`, `type`, `status` (`pending|sent|delivered|read|failed|cancelled`), `data`, `metadata`, template/category/action fields, scheduling and lifecycle timestamps, expiry, feed/channel fields, `messageId`, `deliveryId`, `seen/seenAt`, `archived/archivedAt`, `subscriberId`, `priority`, `avatar`.
  - Ownership/context: optional `userId -> User`, `tenantId -> Tenant`, optional `createdBy -> TenantMember`.
  - Indexes: `(userId,status)`, `(tenantId,createdAt)`, `(type,status)`, `(tenantId,feedId)`, `(subscriberId,seen)`, `(transactionId,tenantId)`.
  - Supports both dashboard-user and subscriber-centric inbox access patterns.

#### Dead letters / alerts

- Entities registered in data-source: `DeadLetter` (`modules/messaging/entities/dead-letter.entity.ts`), `SystemAlert` (`modules/messaging/entities/system-alert.entity.ts`), with corresponding migrations (`1784543893390-dead-letters.ts`, `1784543899517-system-alerts.ts`). Queue/admin pipeline feeds admin/dead-letter handling (see §6).

### 4.2 Campaigns and workflows

- **Campaign:** `apps/api/src/modules/campaign/entities/campaign.entity.ts` (`campaigns`, `BaseEntity`)
  - Tenant-scoped: `tenantId`, FK `tenant` cascade delete, index `(tenantId,status)`.
  - Flexible JSONB model: `channels[]`, `audience`, `schedule`, `templates[]`, `analytics`; `type` and `status` are varchar unions in TS (not DB enums), defaults `one_time`/`draft`.
  - Optional creator `TenantMember`.

- **Workflow:** `apps/api/src/modules/workflow/entities/workflow.entity.ts` (`workflows`, `BaseEntity`)
  - Tenant-scoped definition: `tenantId`, `name`, `description?`, `trigger` (`manual|event`), `status` (`active|paused|archived`), `steps: WorkflowStep[]` (JSONB) including `send|delay|wait|wait_for_event|set`, `metadata`.
  - Index `(tenantId,status)`.

- **WorkflowRun:** `apps/api/src/modules/workflow/entities/workflow-run.entity.ts` (`workflow_runs`, `BaseEntity`)
  - Execution state: `tenantId`, `workflowId`, `status` (`running|waiting|waiting_for_event|completed|failed|cancelled`), `currentStep`, `context` JSONB, `waitEvent`, `waitUntil`, `errorMessage`, `startedAt`, `completedAt`.
  - Indexes support lookup by tenant/workflow/status and waiting-event scans: `(tenantId,workflowId,status)`, `(tenantId,status)`.

### 4.3 Billing, tokens, and quotas

- **Token wallet:** `apps/api/src/modules/billing/entities/token-balance.entity.ts`
  - `token_balances`: one row per tenant (`tenantId` unique), tracks `totalTokens`, `usedTokens`, `availableTokens`, `reservedTokens`, `lastUsage`, `lastPurchase`; `onDelete: CASCADE` from tenant.
  - `token_transactions` (same file): append-like ledger rows with `type` (`purchase|usage|refund|bonus|expiry`), `amount`, `balanceAfter`, `description`, `metadata`, `referenceId`, timestamps. Index `(tenantId,createdAt)` and **partial unique idempotency index** on `(tenantId,referenceId)` where `type='purchase' AND reference_id IS NOT NULL` (`IDX_token_purchase_reference_unique`).
- **Subscription:** `apps/api/src/modules/billing/entities/subscription.entity.ts`
  - Tenant FK, plan/status/provider enums, external IDs, pricing/period/trial/cancel fields, relation to `TokenPurchase[]`.
- **Related billing entities present in data-source:** `TokenPurchase`, `AutoTopupConfig`, `TenantPaymentMethod`, `WebhookEvent` (billing), `TenantBillingInfo` (tenant module). Detailed fields not fully read here.
- **Project send quota:** `apps/api/src/modules/quotas/entities/project-send-quota.entity.ts` (`project_send_quotas`)
  - Opt-in per-project burst control: unique `projectId`, `tenantId`, `limit`, `windowSeconds` (default 60), `enabled`. Comment states: _no row => unbounded; tenant token wallet still handles cost/billing; counted across all channels_.

### 4.4 Providers, delivery infrastructure, and configuration

- **ProviderConfig:** `apps/api/src/modules/provider/provider-config.entity.ts` (`provider_configs`)
  - Project-scoped: `projectId`, `providerId/providerName/providerType`, `channel`, encrypted-ish `config` JSON, `priority`, `isActive`, `isDefault`, `supportedCountries`, `rateLimits`, `metadata`.
  - Uniqueness/lookup: unique `(projectId, providerId, channel)`; indexes `(projectId,channel)`, `(projectId,isActive)`.
  - Belongs to `Project` (cascade delete) and `createdBy` TenantMember.
- **ProviderUsageLog:** `apps/api/src/modules/provider/entities/provider-usage-log.entity.ts` (`provider_usage_logs`)
  - Aggregated usage/cost/latency per `providerConfigId` and `channel` over `[periodStart, periodEnd]`: counts, cost splits, `averageLatencyMs`, `errorBreakdown`, `currency`.
- **Device registrations:** `apps/api/src/modules/provider/entities/device-registration.entity.ts` (`device_registrations`)
  - Subscriber push/device targeting: `subscriberId`, `tenantId`, `deviceToken`, `platform`, `provider`, `appBundleId`, `deviceInfo`, `isActive`, `lastSeen`, `registeredAt`, `metadata`.
  - Uniqueness/indexing: unique `(deviceToken, subscriberId, tenantId)`, indexes for subscriber/tenant, platform/provider active sets.
  - Service supports inactive cleanup and **GDPR erase by subscriber** (`eraseSubscriber` in `device-registration.service.ts`, per grep).
- **Other provider/infra entities in data-source:** `PushCertificate`, `WABAConfig`, `TenantWABAConfig`, `TenantWABAAssignment`, `VoiceCall` migration exists on disk but entity/registration not verified in this pass.
- **Templates/configuration:** `Template` (`modules/template/template.entity.ts`) stores tenant/project-scoped content (`channel`, `subject`, `data`, `variables`, `status/versioning`, `channelSpecific`); `Configuration`/`ConfigurationVersion` entities registered in data-source for config management.

### 4.5 Preferences, topics, and suppression

- **Notification preferences:** `apps/api/src/modules/preferences/entities/notification-preference.entity.ts` (`notification_preferences`)
  - Per `(tenantId, subscriberId, channel)` opt-in/out (`enabled`), timestamps. Created with unique constraint and lookup index in `AddConsentTables1791470700000`.
- **Quiet hours:** `apps/api/src/modules/preferences/entities/subscriber-quiet-hours.entity.ts` (`subscriber_quiet_hours`)
  - Per `(tenantId, subscriberId)` schedule window (`timezone`, `startMinute`, `endMinute`, `enabled`).
- **Suppressions:** `apps/api/src/modules/preferences/entities/notification-suppression.entity.ts` (`notification_suppressions`)
  - Stores suppressed `address` with optional `channel`, `reason`, `tenantId`, `createdAt`.
  - Migration creates partial unique index for channel-specific rows (`WHERE channel IS NOT NULL`) but **no equivalent uniqueness for global/channel-null suppressions** (`AddConsentTables1791470700000.ts`).
- **Topics:** `apps/api/src/modules/topics/entities/topic.entity.ts`
  - `topics`: unique `(tenantId,name)`, optional `projectId`.
  - `topic_subscriptions`: unique `(topicId, subscriberId)`.
  - Topics migration file exists (`1791800000000-AddTopics.ts`) but was **not seen in `data-source.ts` migration list** (potential registration drift).

## 5) Redis and BullMQ usage

### BullMQ (durable async processing via Redis-backed queues)

- **Queues/constants:** `apps/api/src/modules/messaging/queue/notification-queue.constants.ts`
  - `notification-queue`, `notification-delivery-queue`, `notification-admin-queue`.
- **Registration/defaults:** `apps/api/src/modules/messaging/queue/notification-queue.module.ts`
  - `BullModule.registerQueue(...)` for all three with retry/backoff and retention of completed/failed jobs (`removeOnComplete/removeOnFail`, attempts, exponential backoff).
  - Exposes services/processors including `NotificationQueueService`, `NotificationProcessor`, `DeliveryProcessor`, `DeliveryExecutorService`.
- **Processing roles (from code/tests/grep):**
  - `NotificationProcessor` (`@Processor(NOTIFICATION_QUEUE)`) fans out/enqueues deliveries, schedules/retries, and routes admin/dead-letter/alert jobs to admin queue; injects all three queues.
  - `DeliveryProcessor` (`@Processor(NOTIFICATION_DELIVERY_QUEUE)`).
  - `DeadLetterProcessor` handles `NOTIFICATION_ADMIN_QUEUE` jobs (e.g. dead-letter alert email/handling in `dead-letter.processor.ts`).
- **Implication:** primary send pipeline state transitions are coordinated through DB entities **and** BullMQ jobs; correctness depends on idempotent handlers/transaction boundaries (not fully audited here).

### Redis (non-queue state/infrastructure concerns)

- Direct Redis usage (`ioredis` / `@nestjs-modules/ioredis`) appears in shared infrastructure/services:
  - Throttling: `common/throttler/redis-throttler-storage.ts` (+ spec) — distributed increment/fail-open behavior.
  - Circuit breaker: `common/errors/services/circuit-breaker.service.ts` stores circuit state in Redis.
  - Configuration cache: `modules/configuration/services/configuration-cache.service.ts`.
  - DI/tests/validation reference Redis modules/URLs (`common/throttler/di-resolution.spec.ts`, `config/environment.validator.ts`, test helpers).
- No evidence in this pass that Redis is the system-of-record for business aggregates; it is used for **coordination/caching/rate-limiting/resilience** and as BullMQ backend.

## 6) Lifecycle, retention, and erasure behavior

### Retention

- **Tenant-configurable inputs:** `TenantSettings.contentRetentionDays`, `TenantSettings.retentionPolicy.*`, `TenantSettings.notificationStoragePolicy` (`tenant-settings.entity.ts`).
- **Compliance retention job:** `apps/api/src/modules/compliance/compliance.service.ts`
  - Default policies: `notifications` (messages, 2555d), `notification_content` (90d), `notification_metadata` (90d), `deliveries` (365d, but `case "deliveries"` does nothing), `logs` (90d), `audit_trails` (2555d, `autoDelete:false`).
  - `performRetentionCleanup(tenantId?)` resolves effective content/metadata days from tenant settings and:
    - deletes old `messages` (`notifications` policy),
    - deletes old `in_app_notifications` and **scrubs** old `messages.data/subject` to NULL (`notification_content`),
    - deletes old `notification_logs` (`notification_metadata`/`logs`).
  - Scheduled daily at 03:00 via `@Cron` over all tenants in `tenant_settings` (`runScheduledRetentionCleanup`).
  - **Important limitation:** if `tenantId` is not provided, most switch branches skip deletions; scheduled run iterates tenants from settings, so tenants without settings rows may be excluded.
- **Other cleanup/retention-like routines (service-level):** security event cleanup, circuit-breaker cleanup, provider performance data cleanup, inactive device cleanup, generic `ComplianceService.hasRetentionExpired` helper, etc. (grep results across modules). These are independent of the compliance module’s policy engine.

### Erasure / subject deletion

- **Inbox/subscriber erase seam (actual deletion helper):** `apps/api/src/modules/notifications/services/inbox-erase.ts`
  - `eraseInboxBySubscriber(repository, tenantId, subscriberId)` deletes `in_app_notifications` by `(tenantId, subscriberId)` and also by `(tenantId, user_id=subscriberId)` where `subscriber_id` differs/null to cover dual identity fields.
- **Preferences erasure:** `PreferencesService.eraseSubscriberData(...)` exists and is invoked from `preferences.controller.ts` (`DELETE` flow) and tested; intended to remove subscriber preference data (exact implementation not fully read here).
- **Topics erasure:** `TopicsService.eraseSubscriber(...)` present (grep).
- **Device erasure:** `DeviceRegistrationService.eraseSubscriber(...)` present (grep/service comment).
- **In-app feed/notification center services:** call inbox erase seam (`in-app-feed.service.ts`, `notification-center.service.ts`) and note cross-store erasure should go through `PreferencesService.eraseSubscriberData`.
- **Compliance module erasure:** `ComplianceService.deleteUserData` (`compliance.service.ts`)
  - Deletes `notification_logs` where `{ tenantId, to: userId }` and `message_deliveries` where `{ recipient: userId }` (no tenant predicate on deliveries delete), logs audit entry, returns counts/status. It **does not** erase `messages`, `in_app_notifications`, device registrations, preferences/topics/suppressions, or all related identifiers for a subscriber — so it is a partial/incomplete erasure path relative to the rest of the system.
- **Compliance controller:** exposes GDPR-style export/erasure/retention endpoints (`modules/compliance/compliance.controller.ts`, per grep).

### TTL/expiry-like fields

- `in_app_notifications.expiresAt` exists (entity field) — expiry enforcement depends on query/service logic (not verified).
- Session/security/circuit-breaker subsystems have time-based cleanup patterns (grep), but not DB TTL constraints.

## 7) Concrete correctness/stability issues and change-impact notes (observed)

1. **Migration registration drift / non-deterministic schema coverage**
   - **Evidence:** `migrationsRun: true` with explicit `migrations[]` in `data-source.ts`; filesystem/index include migrations not present in that array (e.g. `1791800000000-AddTopics.ts`, voice-call/inapp-feed migrations, `TemplateVersioningColumns1791470100000`).
   - **Impact:** environments may boot without applying on-disk migrations, causing runtime query/entity mismatches; `Topics`/other features may lack backing tables in some deployments.
   - **Scoped fix direction:** reconcile `migrations/index.ts`, `data-source.ts` imports/arrays, and actual schema; add CI check that every migration file/class is registered once.

2. **Entity model heterogeneity (PK strategy/types and base class usage)**
   - **Evidence:** `BaseEntity` uses `varchar(36)` app-assigned IDs (`base.entity.ts`), while many core tables/entities use `uuid` `PrimaryGeneratedColumn` (`Message`, `MessageDelivery`, `DeliveryEvent`, billing, provider, preferences, etc.).
   - **Impact:** increases risk of FK/type mismatches, inconsistent join/index behavior, and painful future migrations/refactors; complicates generic repository/scoping utilities.
   - **Scoped fix direction:** standardize ID strategy per domain boundary or codify mapping rules; verify DB column types align with entity decorators and FKs.

3. **`ProviderConfig.tenantId` is relation-derived, not persisted**
   - **Evidence:** getter reads `this.project?.tenant.id`; entity stores `projectId` only (`provider-config.entity.ts`).
   - **Impact:** tenant checks/scopes that rely on `tenantId` without eager-loading `project.tenant` can silently fail or be bypassed in service logic.
   - **Scoped fix direction:** persist/denormalize `tenant_id` + composite indexes/constraints, or enforce repository/service APIs that always scope via joined project/tenant predicates.

4. **Compliance erasure/retention is incomplete and can be mis-scoped**
   - **Evidence:** `deleteUserData` deletes only `notification_logs` (tenant+to) and `message_deliveries` (recipient only) and does not touch inbox (`in_app_notifications`), messages, devices, preferences/topics/suppressions (`compliance.service.ts:200-235`). `deliveries` retention policy branch is empty (`:315`). Scheduled retention only iterates tenants present in `tenant_settings` and per-tenant cleanup branches mostly no-op when `tenantId` absent.
   - **Impact:** GDPR/erasure requests may leave subscriber data behind in multiple stores; `deliveries` retention policy is ineffective; tenants lacking settings may never be cleaned by scheduler.
   - **Scoped fix direction:** centralize "erase subscriber across stores" orchestration (reuse `eraseInboxBySubscriber`, `PreferencesService.eraseSubscriberData`, `DeviceRegistrationService.eraseSubscriber`, `TopicsService.eraseSubscriber`, suppression/prefs cleanup as applicable) and make retention coverage explicit/auditable per table.

5. **Suppression uniqueness gap for global suppressions**
   - **Evidence:** migration creates unique index only when `channel IS NOT NULL`; entity/table allows nullable channel (`AddConsentTables1791470700000.ts`, `notification-suppression.entity.ts`).
   - **Impact:** duplicate global suppressions possible, causing ambiguous enforcement behavior and storage bloat.
   - **Scoped fix direction:** add unique constraint/index for `(tenant_id,address)` when `channel IS NULL` (or a normalized sentinel) plus application-level upsert semantics.

6. **Dual identity model for inbox recipients (`userId` vs `subscriberId`)**
   - **Evidence:** `InAppNotification` stores both; erase seam must delete by both paths (`in-app-notification.entity.ts`, `notifications/services/inbox-erase.ts`).
   - **Impact:** any query/erase/export path that filters on only one identifier can miss records; increases correctness burden for authorization and GDPR flows.
   - **Scoped fix direction:** define canonical recipient identity per channel/feed, backfill/normalize, and constrain write paths.

7. **Data-source vs module-local entity duplication/placement**
   - **Evidence:** entities live under module folders and also under `common/database/entities/index.ts` with partial exports; data-source imports some from barrel and some directly.
   - **Impact:** easy to register an entity in one place but not another; raises risk of runtime metadata/migration drift and circular dependency confusion.
   - **Scoped fix direction:** single source of truth for entity registration and ownership boundaries.

8. **Async pipeline correctness depends on DB+queue consistency (not fully guaranteed here)**
   - **Evidence:** BullMQ queues with retries/backoff and multiple processors (`notification-queue.module.ts`, `notification.processor.ts`, `delivery.processor.ts`, admin/dead-letter handling) operate on mutable message/delivery/log state.
   - **Impact:** without strict idempotency keys, outbox/atomic state transitions, and duplicate-event handling, retries/crashes can produce duplicate deliveries, stale statuses, or lost terminal transitions.
   - **Scoped fix direction:** verify per-job idempotency (`idempotency` module is imported in queue module), unique business keys for external/provider events, and transactional/state-machine guards on delivery updates.

## 8) Practical change-impact map

- **Adding/changing tenant scoping:** touches almost every write/read path; prefer enforcing predicates on stored `tenant_id` columns (beware relation-derived scopes like `ProviderConfig`).
- **Schema changes:** must update entity, migration file, migration registration in `data-source.ts` (and index consistency), and consider `migrationsRun: true` startup behavior.
- **Erasure/retention changes:** must account for all stores holding recipient identifiers (`notification_logs.to`, `message_deliveries.recipient`, `in_app_notifications.userId/subscriberId`, `device_registrations.subscriberId`, preferences/topics/suppressions, message recipient JSON) and cross-store orchestration.
- **Delivery/event changes:** coordinate `messages`, `message_deliveries`, `delivery_events`, `notification_logs`, and queue processors to preserve lifecycle invariants and idempotency.
- **Quota/billing changes:** `ProjectSendQuota` gates burst at project scope while `TokenBalance/TokenTransaction` represent tenant wallet/cost state; partial unique index on purchase `referenceId` is a key correctness constraint.

## 9) Files most relevant to this model

- `apps/api/src/common/database/data-source.ts`
- `apps/api/src/common/database/entities/base.entity.ts`, `apps/api/src/common/database/entities/index.ts`
- `apps/api/src/common/database/migrations/index.ts`, `.../migrations/AddConsentTables1791470700000.ts`, and related migration files under `apps/api/src/common/database/migrations/`
- `apps/api/src/modules/tenant/entities/tenant.entity.ts`, `apps/api/src/modules/tenant/entities/tenant-settings.entity.ts`
- `apps/api/src/modules/project/entities/project.entity.ts`
- `apps/api/src/modules/messaging/message.entity.ts`, `apps/api/src/modules/messaging/message-delivery.entity.ts`
- `apps/api/src/modules/messaging/entities/delivery-event.entity.ts`, `apps/api/src/modules/messaging/entities/in-app-notification.entity.ts`, `apps/api/src/modules/messaging/entities/dead-letter.entity.ts`, `apps/api/src/modules/messaging/entities/system-alert.entity.ts`
- `apps/api/src/modules/notifications/entities/notification-log.entity.ts`, `apps/api/src/modules/notifications/services/inbox-erase.ts`
- `apps/api/src/modules/campaign/entities/campaign.entity.ts`
- `apps/api/src/modules/workflow/entities/workflow.entity.ts`, `apps/api/src/modules/workflow/entities/workflow-run.entity.ts`
- `apps/api/src/modules/billing/entities/token-balance.entity.ts`, `apps/api/src/modules/billing/entities/subscription.entity.ts`, `apps/api/src/modules/quotas/entities/project-send-quota.entity.ts`
- `apps/api/src/modules/provider/provider-config.entity.ts`, `apps/api/src/modules/provider/entities/provider-usage-log.entity.ts`, `apps/api/src/modules/provider/entities/device-registration.entity.ts`
- `apps/api/src/modules/preferences/entities/notification-preference.entity.ts`, `apps/api/src/modules/preferences/entities/subscriber-quiet-hours.entity.ts`, `apps/api/src/modules/preferences/entities/notification-suppression.entity.ts`
- `apps/api/src/modules/topics/entities/topic.entity.ts`
- `apps/api/src/modules/compliance/compliance.service.ts`, `apps/api/src/modules/compliance/compliance.controller.ts`
- `apps/api/src/modules/messaging/queue/notification-queue.module.ts`, `.../notification-queue.constants.ts`, `.../notification.processor.ts`, `.../delivery.processor.ts`, `.../dead-letter.processor.ts`
- `apps/api/src/common/throttler/redis-throttler-storage.ts`, `apps/api/src/common/errors/services/circuit-breaker.service.ts`, `apps/api/src/modules/configuration/services/configuration-cache.service.ts`
