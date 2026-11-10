# [002] Domain vocabulary and tenancy model

- **Label:** `wayfinder:research`
- **Status:** closed (resolved)
- **Parent map:** [Whole-repo understanding map](../MAP-001-whole-repo-understanding.md)
- **Blocked by:** none
- **Blocks:** none (informs fog graduation)

## Question

What is the canonical domain vocabulary and tenancy model of Sanarwa as implemented and documented — Tenant/Project/membership & roles, Subscriber/recipients, Channel, providers and BYOP, tokens/billing concepts, core notification concepts — and where do docs and code agree or diverge (e.g. known-stale claims) — stated clearly enough to serve as the shared language for the understanding map?

## Resolution

# Sanarwa domain vocabulary and tenancy model (research ticket [002])

**Repo:** `/home/daniel/Documents/projects/sanarwa`
**Scope:** docs + code grounding (quick-to-medium).
**Primary sources read:** `CONTEXT.md`, `ARCHITECTURE.md`, `README.md`, `PRODUCT.md`, `ntfy-sanarwa.md`, `NTFY-SARAWA-SUMMARY.md`, plus key API modules/entities/enums for tenant, project, tenant-member, api-key, notifications, messaging, provider, topics, preferences, billing, token-management.
**No files were modified.**

## 1. Canonical vocabulary (shared language)

| Term                               | Canonical meaning in this repo                                                                                                                                                                                                                                                                                                                         | Notes                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenant**                         | The paying/root organisation and the root scope for data, config, billing, and delivery (`CONTEXT.md`, `tenant.entity.ts`).                                                                                                                                                                                                                            | UI/older docs may say “workspace” (`CONTEXT.md`, `README.md` auth/register copy); treat **Tenant** as canonical.                                                                                                                   |
| **Project**                        | A grouping inside a tenant; owns API keys and provider configs in the implemented model (`project.entity.ts`, `api-key.entity.ts`, `provider-config.entity.ts`).                                                                                                                                                                                       | `ARCHITECTURE.md` states `Tenant → Project → ApiKey`. `CONTEXT.md` states “API keys belong to a project, not directly to a tenant.”                                                                                                |
| **Tenant member**                  | A user’s membership in one tenant; carries role/status and is the actor for many created resources (`tenant-member.entity.ts`).                                                                                                                                                                                                                        | Links `User` ↔ `Tenant` (`tenantId`, `userId`, unique pair).                                                                                                                                                                       |
| **Tenant member role**             | Membership role: `owner`, `admin`, `member`, `viewer` (`CONTEXT.md`, `common/enums/tenant-member.enum.ts` implied by entity).                                                                                                                                                                                                                          | Entity defaults to `MEMBER`.                                                                                                                                                                                                       |
| **API key**                        | Machine credential scoped to a **project**; resolves project and (via project) tenant context (`api-key.entity.ts`: `projectId`, `get tenantId()`). Has environment, status, permissions, expiry, usage/rate-limit fields.                                                                                                                             | Auth model per docs: JWT for users, API key for machines.                                                                                                                                                                          |
| **Subscriber**                     | A recipient identity for in-app/topics/preferences (string `subscriberId`) — e.g. inbox items, topic subscriptions, quiet hours, preferences, gateway rooms (`in_app_notifications.subscriberId`, `topic_subscriptions.subscriberId`, `notification_preferences.subscriberId`, `subscriber_quiet_hours.subscriberId`, `notification-center.types.ts`). | **Not a single first-class entity named “Subscriber”** in the grounded modules; it is an identifier used across subsystems. Distinct from `User`/`TenantMember` though sometimes correlated (`userId` also exists on in-app rows). |
| **Recipient**                      | A delivery target for a message/send: address/token/identifier per channel (`MessageRecipient` in `messaging/message.entity.ts`, `to` in `public-send-message.dto.ts`, `message_deliveries.recipient`).                                                                                                                                                | `MessageRecipient` can carry `email`, `phone`, `deviceToken`, `whatsappNumber`, chat addresses/webhooks, `userId`, metadata. `PRODUCT.md`: “recipients carrying addresses per channel.”                                            |
| **Channel**                        | How a message reaches a recipient. Canonical enum is `NotificationChannel` (`common/enums/notification-channel.enum.ts`, 8 values).                                                                                                                                                                                                                    | Stored as channel values on messages/deliveries/provider configs/logs (see §4).                                                                                                                                                    |
| **Provider**                       | External service that delivers on a channel (e.g. ZeptoMail/Mailgun/SMTP/Twilio/Termii/FCM/Meta/Telnyx) (`CONTEXT.md`, `provider-orchestrator.service.ts`, provider modules).                                                                                                                                                                          | Adapters sit behind channel-specific interfaces; orchestrator is the send seam.                                                                                                                                                    |
| **Managed provider**               | Sanarwa-operated/platform credentials; billed at managed token rates (`CONTEXT.md`, token pricing).                                                                                                                                                                                                                                                    | Fallback/managed chains are channel-specific in code (e.g. email `zeptomail → mailgun → sendgrid`, push `fcm → apple-push → expo-push`; SMS via routing service).                                                                  |
| **BYO BYOP**                       | Tenant-supplied credentials for an integrated provider; billed at flat BYO event rate where eligible (`CONTEXT.md`, `BillingMode`, `provider_configs`, `ProviderOrchestratorService.getBYOPProvider`/BYOP factories).                                                                                                                                  | `ProviderConfig` is project-scoped, stores encrypted config, channel/provider identity, priority/active/default flags. BYOP is resolved before managed fallback in orchestrator paths.                                             |
| **Provider orchestrator**          | `ProviderOrchestratorService` (`modules/provider/provider-orchestrator.service.ts`) — central outbound seam: resolve BYOP or managed path, invoke provider, map outcomes, prune invalid push tokens, and charge tokens on success.                                                                                                                     | Also hosts voice/in-app send helpers and chat connection test behavior.                                                                                                                                                            |
| **Message**                        | A send/request record in the messaging domain (`messaging/message.entity.ts`): tenant-scoped, channels, recipients, variables, status/priority/scheduling, optional subject/data/template/metadata, deliveries relation.                                                                                                                               | Internal model; not identical to every public request DTO.                                                                                                                                                                         |
| **Message delivery**               | Per-recipient/channel/provider delivery record (`messaging/message-delivery.entity.ts`): status lifecycle, provider ids/response/error, retry count, timestamps (sent/delivered/opened/clicked), tenant/message linkage.                                                                                                                               | Status enum richer than what all paths currently advance (see divergences).                                                                                                                                                        |
| **In-app notification inbox item** | Persisted inbox row in `in_app_notifications` (`messaging/entities/in-app-notification.entity.ts`) with subscriber/user linkage, read/seen/archived state, expiry, actions, metadata, message/delivery correlation. Notification center exposes a view over these rows (`notifications/services/notification-center.types.ts`, `toItem`).              | Two overlapping inbox-facing surfaces exist in codebase history/structure (`modules/in-app`, `modules/notifications` notification-center) as noted in stale/summary docs; both operate on the same table conceptually.             |
| **Token**                          | Unit of spend/usage, not currency (`CONTEXT.md`, `ARCHITECTURE.md`).                                                                                                                                                                                                                                                                                   | Used for channel/event metering and balances.                                                                                                                                                                                      |
| **Billing mode**                   | `managed` or `byo` (`token-pricing.ts`, orchestrator charging).                                                                                                                                                                                                                                                                                        | Effective mode can be constrained by channel eligibility.                                                                                                                                                                          |
| **Topic**                          | Tenant-scoped named audience for fan-out subscriptions (`topics/entities/topic.entity.ts`: unique `[tenantId, name]`, optional `projectId`). `TopicSubscription` links `topicId` ↔ `subscriberId`.                                                                                                                                                     | Used by engine/topic services for broadcast-style addressing (per comparison docs/code refs), but this is additive to recipient-addressed model.                                                                                   |

## 2. Tenancy model (implemented shape)

### 2.1 Hierarchy and ownership

- **Tenant is root:** `Tenant` has status, quotas/usage JSON, `subdomain`, `inviteCode`, owner, settings/billing-info, and one-to-many relations to members, projects, invites, brands, templates, push certificates, webhooks (`tenant.entity.ts`).
- **Project belongs to tenant:** `Project` has `tenantId`, status/metadata, unique `(tenantId, name)`, and owns relations to API keys, provider configs, templates, push certificates (`project.entity.ts`).
- **API key belongs to project:** `ApiKey` stores hash/prefix, env/status, permissions, rate limits, expiry/usage; FK to `projectId` (cascade) and optional creator member (`api-key.entity.ts`). Tenant is derived via `project.tenant`/`project.tenantId` accessors.
- **Provider config is project-scoped in storage:** `ProviderConfig` keyed by `projectId` + `(projectId, providerId, channel)` uniqueness, stores channel/provider/type/config/priority/flags/rate-limits; tenant derived via project (`provider-config.entity.ts`). Orchestrator BYOP lookup is by `tenantId + channel` via repository (`getBYOPProvider`), so runtime resolution is tenant/channel-oriented while persistence is attached to project.
- **Tenant member binds user to tenant:** unique `(tenantId, userId)` with role/status/profile fields and relations to created resources (api keys, invites, projects, templates, provider configs, messages, etc.) (`tenant-member.entity.ts`).

### 2.2 Identity and auth (documented vs implemented signals)

- **Documented canonical auth model:** “Auth is **JWT for users, API-key for machines**. Passport strategies: `api-key`, `google`, `github`.” (`CONTEXT.md`).
- **API key as machine credential:** implemented entity and project/tenant resolution support this (`api-key.entity.ts`).
- **Important divergence stale claim:** `CONTEXT.md` states “There is no Better Auth in this repo — the `BETTER_AUTH_*` env keys in `.env.example` are leftovers and are not read.” `AGENTS.md` (repo instructions, untracked) explicitly marks this as **known stale**: Better Auth is now mounted (`main.ts` imports `betterAuthHandler` from `modules/auth/better-auth.ts`, deps present) while `.env.example` keys may still be unused. **Treat `CONTEXT.md`’s “no Better Auth” as outdated; treat JWT/API-key/Passport description as partially historical pending full auth audit.**
- **README/API docs drift:** README shows `/api/v1/auth/login`, `/auth/register` and “provisions a default workspace” flows/examples; this is higher-level/product-facing and may not reflect current canonical auth paths/strategy details. Use `CONTEXT.md` + auth module code as source of truth for implementation language, but note the Better Auth stale note above.

### 2.3 Scope rule (architectural intent)

- `ARCHITECTURE.md`: “Every tenant-scoped query must carry a `tenantId`; API keys resolve one from their project.” Messaging/orchestrator paths assert tenant presence for sends (`assertTenantId` in orchestrator).

## 3. Channels, providers, and BYOP

### 3.1 Channel vocabulary (single enum, multiple derived subsets)

- **Canonical:** `NotificationChannel` has 8 values: `email`, `sms`, `push`, `whatsapp`, `in_app`, `voice`, `webhook`, `chat` (`notification-channel.enum.ts`).
- **Derived/exported groupings in same file:** `CoreNotificationChannels` (6, excludes `webhook`,`chat`), `AllNotificationChannels` (8), `BILLABLE_CHANNELS` (7, excludes `webhook`), `BillingChannel` type derived from billable list, `isBillableChannel`.
- **Other constrained vocabularies in use:**
- **Billing/pricing:** keys over `BillingChannel` `MANAGED_CHANNEL_TOKEN_COST` (`token-pricing.ts`); `voice` billed per minute/units.
- **Public send DTO:** `PUBLIC_SEND_CHANNELS` = 7 values (`email,sms,push,whatsapp,in_app,webhook,chat`) — **excludes `voice`** from that specific endpoint’s allowed channel union (`messaging/dto/public-send-message.dto.ts`). Chat provider selector is separate (`chatProvider`).
- **Doc agreement:** `CONTEXT.md` correctly states one vocabulary with derived subsets and varchar(20) storage across message/delivery/provider/template/log columns (code-visible on `Message.channels`, `MessageDelivery.channel`, `ProviderConfig.channel`).

### 3.2 Provider model and send seam

- **Orchestrator is the seam:** all outbound sends go through `ProviderOrchestratorService` methods (`sendEmail`, `sendSMS/sendBulkSMS`, `sendPushNotification`, `sendChatMessage`, `sendVoiceCall`, `sendInAppNotification`, etc.).
- **Resolution pattern:** try tenant BYOP config for channel (and optional provider name) → validate/decrypt/instantiate tenant provider where needed → else managed path. BYOP sends charge as `byo` on success; managed as `managed`.
- **Managed chains/fallback behavior (implemented):**
- Email: ordered managed chain `zeptomail → mailgun → sendgrid`.
- Push: `fcm → apple-push → expo-push` (SNS noted as BYOP-only in comments, analogous to SES-for-email note).
- SMS: preferred providers from `SMSRoutingService` (health/routing-aware) then attempted in order.
- Chat/WhatsApp: **BYOP-only by design in orchestrator** (`sendChatMessage` throws if no tenant connection) — “no platform fallback.”
- Voice: Telnyx-managed path via `VoiceService` in shown code, billed as managed voice.
- In-app: internal write via `InAppOrchestratorService` (not external circuit-broken provider).
- **Outcomes/circuits:** orchestrator uses circuit breaker keys for managed/BYOP/provider calls, maps outcomes (`ProviderSendOutcome`), prunes invalid push tokens on reported failures/sends where applicable, and avoids charging on failed BYOP outcomes in guarded paths.
- **Adapter seam maturity:** `CONTEXT.md`/`ARCHITECTURE.md` note 17 adapters across 5 channel interfaces with differing send signatures (seam named, not fully unified). Adding providers should match the existing adapter shape for that channel.

### 3.3 BYOP specifics

- **Eligibility/pricing concept:** BYO eligible channels per pricing constants are `email,sms,push,whatsapp,voice,chat`; `in_app` is managed-only (`BYO_ELIGIBLE_CHANNELS`, `MANAGED_ONLY_CHANNELS` in `token-pricing.ts`).
- **Config storage:** `ProviderConfig` holds provider id/name/type/channel, JSON config, priority/active/default, rate limits, supported countries; created by tenant member; project-scoped entity.
- **Security:** orchestrator decrypts tenant config before validation/use (`ProviderEncryptionService`); credentials are not treated as plaintext in flow.

## 4. Recipients, subscribers, and addressing

- **Recipient (send-time):** channel-addressable target; may be a single string or array on public DTO (`to`), or structured `MessageRecipient` objects in internal `Message.recipients` with multiple address fields per channel plus metadata.
- **Subscriber (audience/inbox-time):** stable identifier (`subscriberId`) used for in-app feed/center rows, topic subscriptions, notification preferences, quiet hours, and realtime routing/erase operations. Not guaranteed to equal `userId`/member id.
- **User/Member vs Subscriber:** `TenantMember`/`User` are tenancy/auth identities; inbox supports nullable `userId` and `subscriberId` (`in_app_notifications`). Erasure paths account for both subscriber and user identifiers in places (`eraseInboxBySubscriber` semantics referenced in modules).
- **Topics:** enable publish/fan-out to subscribed `subscriberId`s within tenant scope (`Topic`, `TopicSubscription`), complementing direct recipient addressing.

## 5. Tokens, billing, and money concepts

### 5.1 Unit and pricing

- **Token = unit of spend** (not money/minor units): `CONTEXT.md`, `ARCHITECTURE.md`.
- **Managed per-channel token cost** (`token-pricing.ts`): `email 1`, `push 0.5`, `in_app 0.5`, `sms 24`, `whatsapp 48`, `voice 250`, `chat 1`.
- **BYO cost:** flat `1` token per event for BYO-eligible channels (`BYO_EVENT_TOKEN_COST`); managed-only channels keep managed cost when mode is BYO.
- **Voice units:** cost resolved with `units`/minutes (`Math.ceil` per minute semantics in `resolveTokenCost`).
- **Welcome grant:** `WELCOME_SIGNUP_TOKENS = 3_000`.
- **Billing channel resolution:** `resolveBillingChannel`/`normalizeBillingChannel` map event types to billable channels (`webhook` unbilled by `isBillableChannel` billable set).

### 5.2 Token movement and payments

- **Documented flow:** tokens move through `TokenManagementService`; payments come from a payment provider and are credited by `confirmTokenPurchase` (`CONTEXT.md`).
- **Code evidence:** `TokenPurchaseService.confirmTokenPurchase` `confirmTokenPurchaseIfPaid` exist and are invoked from billing webhook/auto-topup paths (`billing-webhooks.service.ts`, `auto-topup.service.ts`, tests). `TokenManagementService` is the token ledger/balance service module (`modules/token-management`).
- **Payment provider:** `ARCHITECTURE.md` states Bachs is the only payment provider (`PaymentProvider` has single member `BACHS`, webhook `POST /api/v1/billing/webhooks/bachs`), with verification in `utils/bachs-webhook.util.ts` (fail-closed, V2 preferred). This is consistent with billing module structure (`bachs.service.ts`, webhook utils/tests) but not exhaustively re-audited here.
- **Orchestrator charging:** `chargeForSend` calls `billingIntegrationService.processNotificationTokenUsage(...)` with tenant, channel, billing mode, metadata, event count.

### 5.3 Tenancy/billing linkage

- Tenant has quotas/usage fields and billing relations (`Tenant.billingInfo`, billing entities under `modules/billing/entities` such as token balance/purchase/payment method/subscription/webhook-event/auto-topup).

## 6. Core notification concepts (as implemented/documented)

- **Send request vs persisted records:** requests enter via messaging/notification controllers/engine; engine/orchestrator coordinate routing, provider send, and persistence. `Message` + `MessageDelivery` capture request and per-target outcomes in messaging domain.
- **Statuses/lifecycle:** `MessageStatus` = `pending, processing, sent, delivered, partially_delivered, failed, cancelled`. `MessageDeliveryStatus` = `pending, sent, delivered, failed, bounced, opened, clicked, unsubscribed, skipped`.
- **Priority/scheduling:** `MessagePriority` = `low, normal, high, urgent`; `scheduledAt` on messages and queue-based processing/delay semantics are present in module structure (messaging queue/services) and documented in summaries.
- **In-app/inbox lifecycle:** separate in-app status/type/read-seen-archived/expiry model on `in_app_notifications`; notification-center view maps archived/read/unread states (`notification-center.types.ts`, `in-app-notification.entity.ts`).
- **Realtime/transport surfaces:** Socket.IO notification gateway and SSE/provider integrations exist in notifications/in-app modules (code structure), with public streaming/replay features described as evolved in comparison docs; treat those docs as comparative/status snapshots, not sole canonical spec.
- **Preferences/consent primitives present:** `notification_preferences`, `notification_suppressions`, `subscriber_quiet_hours` entities exist (per-subscriber/channel/tenant scoped data). Enforcement completeness has historically been flagged as partial in comparison/task docs; entity presence ≠ guaranteed end-to-end enforcement in every path.
- **Topics/fan-out:** tenant-scoped topics and subscriptions support audience-style delivery to subscribers.
- **Provider config/routing inputs:** project-scoped provider configs (channel/provider/priority/active/default/country/rate-limit metadata) inform BYOP/managed resolution and routing components.

## 7. Agreements (docs ↔ code)

- **Tenant-centric multi-tenancy:** consistent across `CONTEXT.md`, `ARCHITECTURE.md`, README/product framing, and entities (`Tenant` root, tenant-scoped records).
- **Hierarchy `Tenant → Project → ApiKey`:** stated in `ARCHITECTURE.md`/`CONTEXT.md` and reflected by `Project.tenantId`, `ApiKey.projectId`, project relations.
- **Tenant member roles:** `owner/admin/member/viewer` matches documented vocabulary and entity design.
- **Single canonical channel enum with derived subsets:** `NotificationChannel` (8) and derived billable/core/public subsets align with `CONTEXT.md` intent and `notification-channel.enum.ts` `token-pricing.ts` `public-send-message.dto.ts` implementations.
- **BYOP-before-managed orchestration seam:** orchestrator behavior matches documented role of `ProviderOrchestratorService`.
- **Token-based metering with managed vs BYO rates:** pricing constants and orchestrator charging align with `CONTEXT.md`/`PRODUCT.md` token-rate claims (including voice per-minute handling).
- **Bachs as payment provider webhook path (documented):** billing module layout and tests align directionally with `ARCHITECTURE.md` (not a full security audit here).
- **Delivery tracking model exists:** `Message`/`MessageDelivery`/in-app inbox entities support receipt/status tracking described broadly by README/PRODUCT.

## 8. Divergences and known-stale claims

| Area                                    | Claim source                                                                                                                | Observed reality or conflicting signal                                                                                                                                                      | Assessment                                                                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth stack**                          | `CONTEXT.md`: “no Better Auth in this repo…”; `BETTER_AUTH_*` leftovers unread.                                             | `AGENTS.md` states Better Auth is now mounted in `main.ts` (`betterAuthHandler`, deps present) while env keys may still be unused.                                                          | **`CONTEXT.md` stale on Better Auth.** Auth vocabulary must be reconciled from current auth module, not this line.                       |
| **Root docs status**                    | Docs imply stable guidance.                                                                                                 | `AGENTS.md`: nearly all root instruction/docs (including `CONTEXT.md`, `ARCHITECTURE.md`, `DESIGN`-adjacent notes) are untracked and at risk; some referenced rule/skill files are missing. | **Process/documentation divergence risk**; verify before citing doc-only claims.                                                         |
| **Canonical term “workspace”**          | `README.md` (“default workspace”), older UI/code references implied.                                                        | `CONTEXT.md`/entities canonize **Tenant**.                                                                                                                                                  | **Terminology divergence **                                                                                                              |
| **Channel counts/surfaces**             | `PRODUCT.md`: “email, SMS, WhatsApp, push, in-app and voice are the customer-facing channels…”; elsewhere 8 channels exist. | Domain enum has 8; public send DTO allows 7 (no `voice`); billing/webhook/chat surfaces differ by context.                                                                                  | **Surface-specific subsets differ**; do not assume all 8 are exposed uniformly on every API.                                             |
| **Send API shape/examples**             | `README.md` documents `/api/v1/messaging/send` with `channels[]`, multi-recipient payload and certain auth/response shapes. | `PublicSendMessageDto` models single `channel` + `to` (+ content/template/chatProvider) under messaging/public-send surface; internal engine/message models support multi-channel arrays.   | **README/public contract drift likely**; verify endpoint/controller contract before integration docs.                                    |
| **Provider/billing evolution**          | Older docs/summaries referenced SES-managed, `bull@4`, etc.                                                                 | `NTFY-SARAWA-SUMMARY.md` and orchestrator show ZeptoMail managed email, SMTP/BYOP paths, BullMQ-era architecture in repo tooling; managed push chain excludes SNS from managed fallback.    | **Historical comparisons contain time-bound claims**; use current module constants/code as truth.                                        |
| **Suppression/preferences enforcement** | ntfy/task/summary docs previously flagged no-op filters.                                                                    | Preference/suppression/quiet-hours entities exist; later summary notes claim enforcement improvements in engine paths, but not fully revalidated end-to-end here.                           | **Potential behavior/doc lag**; treat enforcement as code-path-specific until verified by tests/flow tracing.                            |
| **Push/delivery richness claims**       | Comparison docs enumerate P0/P1 fixes (some marked done in snapshots).                                                      | Code shows rich adapter/orchestrator capabilities, but endpoint/DTO/status semantics can lag (e.g. delivery lifecycle advancement varies by channel/provider integration).                  | **Feature status is evolving**; snapshots in `ntfy-sanarwa.md`/`NTFY-SARAWA-SUMMARY.md` are informative but not canonical contracts.     |
| **Notification module overlap**         | `ARCHITECTURE.md`/`CONTEXT.md` describe seams; summaries mention dedupe/collapse tasks.                                     | Multiple modules/services/controllers still coexist around messaging, notifications, in-app, notification-center with shared storage concepts.                                              | **Architectural seam divergence/technical debt remains**; vocabulary should distinguish “inbox/in-app store” from specific module names. |
| **Gate/build state**                    | `ARCHITECTURE.md` (older text in file) claims `type-check/build` fail in `apps/api/src/modules/template/**`.                | `AGENTS.md` baseline says that specific claim is no longer true (failures moved to web; API type-check clean).                                                                              | **Stale status note in `ARCHITECTURE.md`.**                                                                                              |

## 9. Practical canonical model (for understanding-map use)

- **Scope chain:** `Tenant` → `Project` → `ApiKey`/`ProviderConfig` (storage) with `TenantMember` linking users to tenant roles.
- **Delivery chain:** `Message` (intent, channels, recipients, priority/schedule) → orchestrated provider send(s) → `MessageDelivery` records (+ in-app inbox row/realtime events for in-app paths) → token charge per billing mode/channel rules.
- **Audience/addressing:** direct `Recipient` addresses/tokens per send; `Subscriber` id for inbox/preferences/topics/realtime identity; `Topic` fans out to subscribed subscribers within tenant.
- **Provider modes:** `managed` (platform creds/rates, channel-specific chains/routing) vs `byo` (tenant creds/config, eligibility and flat-event pricing rules), mediated by `ProviderOrchestratorService`.
- **Money:** `Token` ledger units, per-channel managed costs + BYO flat rate (voice per minute), welcome grant, purchases credited via billing/token-purchase flow.

**Evidence anchors:** `CONTEXT.md`, `ARCHITECTURE.md`, `README.md`, `PRODUCT.md`, `common/enums/notification-channel.enum.ts`, `modules/tenant|project|tenant-member|api-key|provider|messaging|notifications|topics|preferences|billing|token-management` entities/services/constants/DTOs listed above.
