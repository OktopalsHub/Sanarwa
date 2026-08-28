# Sanarwa

Sanarwa is a multi-channel messaging platform. Send email, SMS, push, in-app, WhatsApp, and voice from one place — with projects, branding, templates, and delivery tracking built in.

## Run it locally

1. Copy `.env.example` to `.env` and fill in the values (database, Redis, auth secrets).
2. Start dependencies (Postgres + Redis), then:

```bash
pnpm install
pnpm dev
```

- App: http://localhost:3000
- API: http://localhost:9000

## Build for production

```bash
pnpm build
```

## What you need configured

| Setting                                  | Purpose                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`                           | Postgres connection                                |
| `REDIS_URL`                              | Cache / queues                                     |
| `JWT_AUTH_SECRET` / `JWT_REFRESH_SECRET` | JWT access + refresh signing (long random strings) |
| `PROVIDER_ENCRYPTION_KEY`                | Encrypts provider credentials                      |
| Provider keys (Telnyx, SES, etc.)        | Only for channels you actually use                 |

Optional: `SENTRY_DSN` for error reporting in production.
