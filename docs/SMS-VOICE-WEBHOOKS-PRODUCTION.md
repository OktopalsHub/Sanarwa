# SMS and Voice Webhooks (Production)

This document describes the SMS and Telnyx voice webhook contracts enforced by the API.

## Routing and BYOP policy

- **Africa (default/managed):** Africa's Talking (`africastalking`)
- **Other regions (default/managed):** Telnyx (`telnyx`)
- **BYOP SMS providers:** Telnyx, Africa's Talking, Twilio, Termii, and Infobip are supported as BYOP-capable providers (tenants can add/configure them). Webhook endpoints remain enabled; use tenant-scoped routes for tenant-specific verification where available.

## Required / optional configuration

| Provider                           | Env var / BYOP config key                                                                                                                                | Purpose                                                                                                                                                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Telnyx SMS + voice                 | `TELNYX_PUBLIC_KEY` (global) or tenant SMS provider config `webhookPublicKey` / `publicKey` / `TELNYX_PUBLIC_KEY` / `telnyxPublicKey`                    | Ed25519 public key used to verify `telnyx-signature-ed25519` / `telnyx-timestamp` over the raw request body. **Fail-closed** when key is missing/invalid.                                                                                           |
| Africa's Talking                   | `AFRICASTALKING_WEBHOOK_SECRET` (global) or tenant SMS provider config `webhookSecret` / `AFRICASTALKING_WEBHOOK_SECRET` / `africastalkingWebhookSecret` | Shared secret required for inbound/status callbacks. **Fail-closed** when secret is missing/invalid.                                                                                                                                                |
| Twilio (global/BYOP compatibility) | `TWILIO_AUTH_TOKEN`, `TWILIO_WEBHOOK_URL`                                                                                                                | If configured, Twilio webhooks are HMAC-verified (`x-twilio-signature`) against raw body and callback URL. If `TWILIO_AUTH_TOKEN` is not configured, global Twilio webhook routes accept requests with a warning (BYOP/global-route compatibility). |
| Termii (optional)                  | `TERMII_WEBHOOK_SECRET`                                                                                                                                  | If configured, requires matching secret (`x-termii-webhook-secret`, `x-webhook-secret`, bearer auth, or body secret). If unset, accepted for BYOP compatibility.                                                                                    |
| Infobip (optional)                 | `INFOBIP_WEBHOOK_SECRET`                                                                                                                                 | If configured, requires matching secret (`x-infobip-webhook-secret`, `x-webhook-secret`, bearer auth, or body secret). If unset, accepted for BYOP compatibility.                                                                                   |

Raw request bodies must be preserved for `/webhooks/*` paths (the API captures raw bodies for webhook/billing webhook routes).

## SMS endpoints

Base path: `POST /api/v1/webhooks/sms/...` (public; verified per provider/policy)

### Telnyx

- Managed/global: `POST /telnyx/inbound`, `POST /telnyx/status` (verified with `TELNYX_PUBLIC_KEY`)
- BYOP (tenant-scoped): `POST /telnyx/:tenantId/inbound`, `POST /telnyx/:tenantId/status` (verified with tenant Telnyx SMS provider config public key)

Verification: Ed25519 signature of `${telnyx-timestamp}|<raw-body>`. Requests without valid raw body/signature/timestamp/key are rejected (`400`/`401`).

### Africa's Talking

- Managed/global: `POST /africastalking/inbound`, `POST /africastalking/status` (verified with `AFRICASTALKING_WEBHOOK_SECRET`)
- BYOP (tenant-scoped): `POST /africastalking/:tenantId/inbound`, `POST /africastalking/:tenantId/status` (verified with tenant Africa's Talking SMS provider config webhook secret)

Verification: shared secret match required (`x-africastalking-webhook-secret`, `x-at-webhook-secret`, `Authorization: Bearer <secret>`, or body `webhookSecret`/`secret`). Rejected (`401`) if unconfigured/invalid. Consider edge controls (IP allowlisting) as additional defense.

### Twilio (BYOP)

- `POST /twilio/inbound`, `POST /twilio/status`

Verified with global `TWILIO_AUTH_TOKEN` when configured; otherwise accepted with warning for BYOP/global-route compatibility.

### Termii (BYOP)

- `POST /termii/inbound`, `POST /termii/status`

Optional shared-secret verification via `TERMII_WEBHOOK_SECRET`.

### Infobip (BYOP)

- `POST /infobip/inbound`, `POST /infobip/status`

Optional shared-secret verification via `INFOBIP_WEBHOOK_SECRET`.

### Generic status

- `POST /status/:provider` — routes to provider-specific handlers for `telnyx`, `africastalking`/`africas-talking`, `twilio`, `termii`, `infobip`; unsupported providers rejected.

## Telnyx voice webhook

- `POST /api/v1/webhooks/telnyx/voice` (public)

Verification: Ed25519 signature over raw body using `TELNYX_PUBLIC_KEY` (`telnyx-signature-ed25519`, `telnyx-timestamp`). Invalid/unverified requests are rejected (`401`); missing raw body returns `400`.

> Note: voice webhook currently uses the global Telnyx public key; BYOP tenant-scoped voice webhook verification is not yet implemented.

## Operational notes

- Configure provider dashboards to call the correct (managed or tenant-scoped BYOP) endpoints and include required signing/secret material.
- For BYOP Telnyx/AT, store webhook verification material in the tenant's SMS provider config (encrypted) and use tenant-scoped webhook URLs.
- Rotate secrets/keys in coordination with provider configuration.
- Monitor `401/400` responses for misconfiguration or rejected callbacks.
- Related: `docs/INBOUND-EMAIL-PRODUCTION.md` for inbound email HMAC contract.

## Code references

- `apps/api/src/modules/provider/controllers/sms-webhook.controller.ts`
- `apps/api/src/modules/provider/controllers/telnyx-webhook.controller.ts`
- `apps/api/src/modules/provider/services/webhook-validator.service.ts`
- `apps/api/src/modules/provider/providers/sms/sms.module.ts`
- `apps/api/src/modules/provider/provider.module.ts` (BYOP provider registration)
