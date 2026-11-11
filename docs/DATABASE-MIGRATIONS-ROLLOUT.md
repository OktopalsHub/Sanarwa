# Database migrations — rollout and rollback

How to apply, verify, and roll back the Sanarwa schema migrations.

## Current state (2026-11-10)

- **Baseline chain:** 5 TypeORM migrations in `apps/api/src/common/database/migrations/`, registered in `migrations/index.ts` and `apps/api/src/common/database/data-source.ts`:
  - `1794349055401-InitialSchema` (fresh baseline)
  - `1794349055402-ExplicitExecutionState`
  - `1794349055403-DeliveryStateSplit`
  - `1794349055404-WorkflowScheduleCursor`
  - `1794349055405-NotificationLogTrackingIdIndex`
- **Validated on an empty PostgreSQL 16 database:** `pnpm --filter @sanarwa/api migration:run` applies all 5, creates 54 public tables + `migrations` (5 rows), and `migration:revert` + `migration:run` succeeds for the latest migration. (Validated with `postgres:16-alpine`; `uuid-ossp` present.)
- **Runtime config:** `synchronize: false`, `migrationsRun: true`, `migrationsTransactionMode: "all"` in `data-source.ts`. Migrations run from the **compiled** output (`dist/common/database/data-source.js`), so build before running CLI migrations.

## Baseline strategy for existing environments

This chain **replaces** the previous repaired migration history. There is no safe automatic baseline-stamp path for old environments because entity/schema shape changed (including removed entities such as `tenant_billing_info` / `tenant_waba_assignments` in earlier history) and parity with arbitrary existing schemas is not guaranteed.

| Environment state                                   | How to detect                                                                   | Action                                                                                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fresh / empty DB**                                | No `migrations` table or empty DB                                               | Standard apply (below).                                                                                                                                                                                                                      |
| **Has old migration history / pre-baseline schema** | `migrations` contains rows not matching this 5-migration set, or schema differs | **Do not run `migration:run` in-place.** Applying `InitialSchema` against an existing schema will fail (duplicate objects) or leave inconsistent state. Use reset (disposable) or a planned data-migration cutover (prod/staging with data). |
| **Already on this exact 5-migration set**           | `migrations` has exactly these 5 in order                                       | `migration:run` is a no-op / applies only truly pending ones. Safe to proceed with deploy preflight.                                                                                                                                         |

Before any apply on a non-empty environment, take a backup:

```bash
pg_dump --format=custom --no-owner "$DATABASE_URL" > backup-$(date +%F).dump
```

## Apply procedure

### Fresh environment

```bash
# 1) point apps/api/.env DATABASE_URL at target Postgres
# 2) build compiled migrations/data-source
pnpm --filter @sanarwa/api build
# 3) apply
pnpm --filter @sanarwa/api migration:run
# 4) verify
#    - command exits 0
#    - "has been executed successfully" for pending migrations (or none pending)
```

`pnpm --filter @sanarwa/api dev` / `start:prod` also runs pending migrations at boot (`migrationsRun: true`), but explicit deploy-time `migration:run` is preferred so failures are caught before traffic.

### Existing environment with data (staging/prod) — planned cutover

1. **Backup** production/staging DB and snapshot infra/volumes.
2. **Provision a staging clone/scratch target** (separate database/instance). Restore the backup into it.
3. **Do not** run the baseline against the restored old-schema DB. Instead, validate the target end state:
   - create an **empty** database on the staging Postgres host,
   - run `pnpm --filter @sanarwa/api build && DATABASE_URL=<empty-db> pnpm --filter @sanarwa/api migration:run`,
   - verify schema and boot the API against it, run smoke tests.
4. **Data migration/cutover (manual, required):** export required data from the old schema, transform to match current entities, import into the baseline-migrated database, and reconcile IDs/constraints. (No automated in-place reconciliation exists for this baseline reset.)
5. **Drain/reset Redis/BullMQ state** when swapping databases to avoid jobs referencing removed rows/IDs.
6. **Cut over** app config to the new database only after smoke tests pass; keep backup available for rollback.

### Disposable/dev reset

```bash
# example (docker)
docker exec <postgres> psql -U <user> -d postgres -c "DROP DATABASE IF EXISTS <db>;" -c "CREATE DATABASE <db>;"
pnpm --filter @sanarwa/api build
pnpm --filter @sanarwa/api migration:run
```

## Validated apply on a staging clone (procedure)

Use this to prove a deploy before touching the real environment:

1. **Clone source:** `pg_dump --format=custom --no-owner "$SOURCE_DATABASE_URL" > /tmp/clone.dump` (or storage snapshot).
2. **Restore to isolated clone DB:**
   ```bash
   createdb <clone_db>   # or docker exec ... psql -c 'CREATE DATABASE <clone_db>'
   pg_restore --no-owner -d "$CLONE_DATABASE_URL" /tmp/clone.dump
   ```
3. **Preflight:** record `select name,timestamp from migrations order by id;` and app version. If history is pre-baseline, follow the cutover path above on the clone (do not in-place apply baseline).
4. **Apply & verify (fresh/baseline-compatible target):**
   ```bash
   pnpm --filter @sanarwa/api build
   DATABASE_URL="$CLONE_DATABASE_URL" pnpm --filter @sanarwa/api migration:run
   ```
5. **Smoke checks:** app boots (`/health` 200), critical reads/writes succeed, queues drain without schema errors, and `select count(*) from migrations` matches expected.
6. **Record result** (timestamp, git SHA, DB host, migration rows) before promoting to real staging/prod.

## Rollback

- **Preferred (data safety): restore backup/snapshot.** `pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backup.dump` (or platform snapshot restore). This is the reliable rollback for schema+data.
- **App-only rollback:** redeploy previous image. Safe only if DB schema remains compatible with that image. Because `migrationsRun: true`, ensure the rolled-back image does not trigger unintended migrations at boot.
- **`migration:revert`:** reverts one migration at a time from compiled output. Generated baseline downs are **not** a dependable production rollback and may be destructive/incomplete; use only on disposable/validation databases.
- **If app and DB changed together:** roll back both together (restore DB backup + redeploy matching app).

## Regenerating / adding migrations (development)

```bash
# from an empty DB with current schema target
pnpm --filter @sanarwa/api build
cd apps/api && DATABASE_URL=<empty_db> npx typeorm migration:generate src/common/database/migrations/<Name> -d dist/common/database/data-source.js
# export from migrations/index.ts and register in data-source.ts
pnpm --filter @sanarwa/api build
pnpm --filter @sanarwa/api migration:run
```

Review generated SQL for unsafe drops, enum/type changes, and data-destructive operations before applying anywhere with data.

## Notes

- `apps/api/.env` `DATABASE_URL` must target the intended Postgres instance (local compose often exposes `localhost:5441` in this workspace; verify per environment).
- Reset/drain Redis (BullMQ) when resetting or replacing a database to avoid orphaned jobs referencing deleted rows.
- CI validates migrations on a fresh Postgres by running `migration:run` (and revert/re-run) from the built API; keep that job green.
