# Database migrations — rollout and rollback

How to apply, verify and reset the Sanarwa schema.

## Current state (2026-11-10)

- **Single fresh baseline:** `apps/api/src/common/database/migrations/1794349055401-InitialSchema.ts`, generated from the current TypeORM entities with a real timestamp.
- **Validated:** `pnpm --filter @sanarwa/api migration:run` succeeds on an empty PostgreSQL database and creates the full schema (54 base tables) plus the `migrations` record.
- **API config:** `synchronize: false`, `migrationsRun: true` in `apps/api/src/common/database/data-source.ts`. Migrations are run from the compiled output (`dist/common/database/data-source.js`).

## Fresh environments

```bash
# ensure Postgres is reachable (DATABASE_URL in apps/api/.env)
pnpm --filter @sanarwa/api build
pnpm --filter @sanarwa/api migration:run
```

`pnpm --filter @sanarwa/api dev` / `start:prod` will also run pending migrations on boot because `migrationsRun: true`, but running them explicitly during deploy is preferred so failures are visible before traffic.

## Existing environments (old migration history)

This baseline **replaces** the previous migration chain. Any database that has a populated `migrations` table from the old chain (including the repaired 2025-2026 chain) is **not forward-compatible** with this baseline:

- `migration:run` will try to apply `InitialSchema1794349055401` against a schema that already exists and will fail (duplicate tables/indexes/types).
- There is no safe automatic "stamp baseline as applied" path because the entity set changed (removed: `tenant_billing_info`, `tenant_waba_assignments`; migrations regenerated) and schema parity is not guaranteed.

**Supported options:**

| Environment                          | Action                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Disposable / dev / can lose data** | Drop and recreate the database, then `pnpm --filter @sanarwa/api migration:run`. Example (local docker): `docker exec <postgres> psql -U sanarwa -d postgres -c "DROP DATABASE IF EXISTS <db>;" -c "CREATE DATABASE <db>;"` then run migrations. Flush Redis queues if they reference old IDs/state.                                                  |
| **Staging / production with data**   | **Do not run this baseline in-place.** Either (a) restore to a scratch DB, apply baseline, perform a data migration/export-import into the new schema and cut over; or (b) create and review an explicit transitional migration path that reconciles the old schema to the current entities. Neither is automated today — treat as a planned rollout. |

Always take a backup before any destructive/reset action:

```bash
pg_dump --format=custom --no-owner "$DATABASE_URL" > backup-$(date +%F).dump
```

## Regenerating migrations (development)

When entities change, regenerate a baseline (or incremental migration) against an empty database:

```bash
# 1) start from an empty DB
# 2) build
pnpm --filter @sanarwa/api build
# 3) generate (writes to src/common/database/migrations)
cd apps/api && DATABASE_URL=... npx typeorm migration:generate src/common/database/migrations/<Name> -d dist/common/database/data-source.js
# 4) export from migrations/index.ts and register in data-source.ts, rebuild, validate
pnpm --filter @sanarwa/api build
pnpm --filter @sanarwa/api migration:run
```

Review generated SQL for duplicate index names, unsafe drops, and data-destructive changes before applying anywhere with data.

## Rollback

- **App rollback:** deploy the previous app image. If the schema was not changed incompatibly, it will boot.
- **Schema rollback:** restore from `pg_dump` backup. Down migrations in a generated baseline are not a reliable rollback for production data.
- If app and DB schema changed together, roll back **both** together.

## Notes

- `apps/api/.env` / `DATABASE_URL` must point at the target Postgres instance. Local docker-compose exposes Postgres on `5441` in this workspace’s `.env` (`postgres://sanarwa:sanarwa@localhost:5441/sanarwa_db`); adjust per environment.
- Redis state (BullMQ queues/jobs) should be reset or drained when resetting the database to avoid orphaned job payloads referencing deleted rows.
- The previous repaired migration chain and its history-repair notes were removed as part of the 2026-11-10 schema reset; this baseline is the source of truth going forward.
