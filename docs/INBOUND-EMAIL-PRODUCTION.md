# Inbound Email — Production Readiness Runbook

This documents what is required to receive inbound email into the Sanarwa inbox in production, and how to wire a mail provider/relay to `POST /notifications/inbound`.

**Scope:** code path is implemented, HMAC-verified, fail-closed, and inbox-backed (`in_app_notifications` via `NotificationCenterService.upsertInboundItem`). Operational readiness depends on the steps below.

## 1) Prerequisites

- **API running** with database reachable and migrations applied (includes inbox/notification tables used by the notification center). From the repo root:
  ```bash
  pnpm --filter @sanarwa/api migration:run
  pnpm --filter @sanarwa/api build
  # deploy/start the built API (per your environment)
  ```
- **Secret configured:** set `INBOUND_EMAIL_SECRET` to a long random value (server-only, never accepted from request bodies). Example:
  ```bash
  openssl rand -hex 32
  ```
  Add to the API environment (`.env` / secret store). The API **fails closed** if unset (`503 Service Unavailable`).
- **Validation/throttling:** global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) and global `ThrottlerGuard` are enabled in `apps/api/src/main.ts` / `app.module.ts`. Inbound DTOs are validated at the edge; the endpoint is rate-limited by the global throttler (tune limits/policies and add WAF/source allowlisting per your threat model).

## 2) Endpoint contract

- **URL:** `POST /api/v1/notifications/inbound` (global API prefix applies; unauthenticated/public endpoint, integrity via HMAC).
- **Content-Type:** `application/json`
- **Token:** HMAC-SHA256 hex of the string `${tenantId}:${messageId}:${threadId}:${epochMs}` signed with `INBOUND_EMAIL_SECRET`.
  - `epochMs` is milliseconds since epoch; valid for **24h** with **5m** clock-skew allowance.
  - `messageId` is a dedupe key (upsert per tenant+`messageId`).

### Request body

| Field                       | Required | Notes                                                                  |
| --------------------------- | -------- | ---------------------------------------------------------------------- |
| `tenantId`                  | yes      | Target tenant                                                          |
| `messageId`                 | yes      | Envelope/message id (dedupe)                                           |
| `threadId`                  | yes      | Conversation/thread id                                                 |
| `epochMs`                   | yes      | Signed timestamp (ms, as string)                                       |
| `hmacHex`                   | yes      | HMAC-SHA256 hex of the token string                                    |
| `senderAddress`             | yes      | Sender address (suppression key; not stored in plaintext by this flow) |
| `subject`                   | no       | Subject line                                                           |
| `textBody`                  | no       | Plain-text body (stripped/cleaned by your worker)                      |
| `expiresAt`                 | no       | ISO date; defaults to 30 days                                          |
| `senderHash`, `tokenSecret` | no       | Deprecated/ignored (secret must never come from the body)              |

### Responses

| HTTP  | Body / meaning                                                                              |
| ----- | ------------------------------------------------------------------------------------------- |
| `200` | `{ "status": "received", "messageId", "threadId" }` stored in inbox                         |
| `200` | `{ "status": "suppressed", "reason": "address suppressed" }` sender suppressed (not stored) |
| `400` | Invalid/expired/future `epochMs` (or other bad request)                                     |
| `401` | Invalid token signature                                                                     |
| `503` | Inbound not configured (`INBOUND_EMAIL_SECRET` missing)                                     |
| `429` | Rate limited (global throttler)                                                             |

## 3) Generate a signed payload (wiring/testing)

Use the helper script (no external deps):

```bash
# prints JSON payload with a valid token
INBOUND_EMAIL_SECRET='<your-secret>' node apps/api/scripts/sign-inbound-email.mjs \
  --tenantId '<tenant-id>' \
  --messageId 'msg-001' \
  --threadId 'thread-001' \
  --senderAddress 'sender@example.com' \
  --subject 'Re: hello' \
  --textBody 'hello back'
```

Or generate inline (Node):

```bash
node -e '
const {createHmac}=require("crypto");
const secret=process.env.INBOUND_EMAIL_SECRET;
const tenantId="TENANT", messageId="msg-1", threadId="thread-1";
const epochMs=String(Date.now());
const hmacHex=createHmac("sha256",secret).update(`${tenantId}:${messageId}:${threadId}:${epochMs}`).digest("hex");
console.log(JSON.stringify({tenantId,messageId,threadId,epochMs,hmacHex,senderAddress:"sender@example.com",subject:"Hi",textBody:"Hello"}));
'
```

## 4) Example request

```bash
curl -sS -X POST "$API_BASE/api/v1/notifications/inbound" \
  -H "Content-Type: application/json" \
  -d @payload.json
```

`payload.json` is the JSON produced above. A `200` with `status:"received"` confirms the message is stored in the tenant inbox (`in_app_notifications`).

## 5) Mail provider / relay wiring

1. **Parse inbound MIME** in your mail worker/relay (provider webhook or inbound stream) and extract tenant/message/thread identifiers, sender, subject, and cleaned plain-text body.
2. **Sign** the token with the same `INBOUND_EMAIL_SECRET` using the format above and the current `epochMs`.
3. **POST** the JSON payload to `/api/v1/notifications/inbound`.
4. **Handle outcomes:** treat `200 received|suppressed` as handled; retry on transient failures (5xx/network) with backoff; do **not** blindly retry `400/401` (fix payload/signature/clock). Respect `429`.
5. **Idempotency:** `messageId` is deduped per tenant (safe to retry a received message).

## 6) Operational notes

- Store `INBOUND_EMAIL_SECRET` only in server/worker secret stores; rotate by deploying the new secret to API and worker together.
- Ensure server clocks are reasonably accurate (token window is strict).
- Inbound is a public endpoint protected by HMAC + global throttling; add network/WAF allowlisting to your mail provider/relay IPs where possible.
- `GET /api/v1/notifications/ingest` remains API-key scoped (separate publish path).
- Baseline/full monorepo gates may not all be green on `dev`; verify `@sanarwa/api` build/type-check/tests for the deployed commit in your pipeline.

## References

- Controller: `apps/api/src/modules/notifications/transport/inbound-email/email-inbound.controller.ts`
- DTOs: `apps/api/src/modules/notifications/transport/inbound-email/dto/`
- Storage: `apps/api/src/modules/notifications/services/notification-center.service.ts` (`upsertInboundItem`)
- Helper: `apps/api/scripts/sign-inbound-email.mjs`
