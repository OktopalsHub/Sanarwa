# [011] Documentation landscape and durable understanding artifact

- **Label:** `wayfinder:research`
- **Status:** closed (resolved)
- **Parent map:** [Whole-repo understanding map](../MAP-001-whole-repo-understanding.md)
- **Blocked by:** none (informed by [001]–[010])
- **Blocks:** destination artifact

## Question

How do existing docs (`README`, `ARCHITECTURE`, `CONTEXT`, `PRODUCT`, `AGENTS`, `docs/*`, env/gap docs) relate, what is stale/missing/contradictory, and what durable understanding artifact should be produced to onboard contributors (structure, sources of truth, maintenance guidance)? Produce or outline that artifact as part of resolution. Scoped fixes/refactors/migrations are in scope where they correct or stabilize the system or its documented behavior.

## Resolution

# [011] Documentation landscape and durable understanding artifact — Sanarwa

**Scope:** research-only (no files modified, no branches created during research).  
**Method (medium):** read requested docs and indexes, sampled all wayfinder tickets + MAP, cross-checked key claims against code/config (`apps/api/src/main.ts`, `apps/api/src/modules/auth/better-auth.ts`, `package.json`, `.github/workflows/ci.yml`, `docker-compose.yml`, `docker-compose.dev.yml`, `apps/api/.env.example`, git tracking). Deep subsystem findings also rely on recorded ticket resolutions in `docs/wayfinder/tickets/001–010` and `docs/wayfinder/MAP-001-whole-repo-understanding.md` (treated as existing research artifacts, with spot-checks where easy).

---

## 1. Executive summary

Sanarwa’s documentation is **rich but fragmented and drift-prone**. There is no single durable onboarding source of truth; understanding is split across root “constitution” docs, product/marketing/comparison docs, operational runbooks, package-local docs, and the Wayfinder map/tickets. The **best current orientation spine** is: `README.md` (public/product intro) + `CONTEXT.md`/`PRODUCT.md` (domain/product intent) + `ARCHITECTURE.md` (system shape) + `AGENTS.md` (agent/dev workflow and known baseline) + `docs/wayfinder/*` (deep, evidence-based subsystem research). However, several of these **contradict each other or the code**, and `AGENTS.md` itself contains stale claims.

**Durable artifact produced:** `docs/ONBOARDING.md` — a curated contributor entrypoint with a source-of-truth index, local/env/gates matrix, architecture/flow summaries, known drift/issues, and maintenance guidance. Wayfinder remains the **research/evidence ledger**; onboarding is the **curated map**.

---

## 2. Documentation inventory and roles

### 2.1 Root documents

| Path                                                    | Role                                     | Trust posture                                                                                                                           |
| ------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md` (tracked)                                   | Public/product + quickstart/API overview | **Mixed:** useful intro; endpoint/env/port examples can drift from current contracts and compose topology.                              |
| `AGENTS.md` (untracked)                                 | Agent/dev operating instructions         | **High operational value, partially stale/internally inconsistent** (rule/file tracking claims, CI script drift notes, baseline dated). |
| `CONTEXT.md` (untracked)                                | Canonical domain vocabulary              | **High for domain, stale for auth** (“no Better Auth” contradicted by code).                                                            |
| `ARCHITECTURE.md` (untracked)                           | Stack, seams, module shape               | **High for structural intent, stale in places** (auth/tooling/known-state).                                                             |
| `PRODUCT.md` (untracked)                                | Product definition/positioning           | **Useful for intent; mixed for implementation completeness.**                                                                           |
| `CODING_STANDARDS.md` (untracked)                       | Binding style/structure rules            | **Normative intent; partly aspirational vs current code.**                                                                              |
| `SENIOR-DEV-RULES.md` (untracked)                       | Judgement/delivery/security/schema rules | **Normative intent; includes “not yet true” realities.**                                                                                |
| `DESLOP.md` (untracked)                                 | Anti-slop TypeScript guidance            | **Normative hygiene reference.**                                                                                                        |
| `env.md` (untracked)                                    | Environment/reference runbook            | **Useful but drift-prone** (ports/defaults/topologies can conflict).                                                                    |
| `ntfy-sanarwa.md`, `NTFY-SARAWA-SUMMARY.md` (untracked) | Comparative/gap snapshots                | **Time-bound snapshots, not canonical runtime truth.**                                                                                  |
| `notifkit-sanarwa.md` (untracked)                       | Comparative/gap snapshot                 | **Known stale/risky** in parts (per `AGENTS.md`).                                                                                       |
| `design.md` (untracked)                                 | Marketing/design system spec             | **Marketing surfaces only; not logged-in app UI.**                                                                                      |

### 2.2 `docs/` and package docs

| Path                                                                     | Role                                                                                      |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `docs/wayfinder/MAP-001-whole-repo-understanding.md` + `tickets/001-011` | Evidence-based subsystem research ledger and index (best “how it actually works” corpus). |
| `docs/INBOUND-EMAIL-PRODUCTION.md`                                       | Focused inbound email production runbook.                                                 |
| `docs/EXTENSIBILITY-CAMPAIGNS-WORKFLOWS.md`                              | Campaign/workflow extension seams and status.                                             |
| `packages/sdk/README.md`, `packages/sdk/ENDPOINT-DRIFT.md`               | SDK consumer docs + drift tracking.                                                       |
| `packages/mcp/README.md`                                                 | MCP package usage/config.                                                                 |
| `apps/api/src/modules/billing/PROVIDER-AUDIT.md`                         | Bachs/payment integration constraints and audit notes.                                    |

### 2.3 `.agents` / `.cursor`

- `.agents/rules/` and `.cursor/rules/` are **absent** in this checkout; `AGENTS.md` contains claims that require correction/restoration.

---

## 3. How the docs relate

```text
Public/entry: README.md
  └─ product/quickstart (drift risk)

Agent/dev operating: AGENTS.md
  ├─ read-first → CONTEXT.md, ARCHITECTURE.md, CODING_STANDARDS.md, SENIOR-DEV-RULES.md, DESLOP.md
  ├─ commands/gates/baseline (partly stale)
  └─ known-stale pointers (partly accurate)

Intent/vocabulary: CONTEXT.md, ARCHITECTURE.md, PRODUCT.md
Norms: CODING_STANDARDS.md, SENIOR-DEV-RULES.md, DESLOP.md
Evidence ledger: docs/wayfinder/MAP-001 + tickets/001-011
Runbooks/feature docs: env.md, docs/INBOUND-EMAIL-PRODUCTION.md, docs/EXTENSIBILITY-CAMPAIGNS-WORKFLOWS.md, package/provider docs
Snapshots (non-canonical): ntfy-sanarwa.md, NTFY-SARAWA-SUMMARY.md, notifkit-sanarwa.md, task notes
Curated entrypoint (produced): docs/ONBOARDING.md
```

---

## 4. Sources of truth (by topic)

| Topic                                     | Canonical now                                                             | Supporting                     | Caution                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------- |
| Domain vocabulary                         | `CONTEXT.md`, channel/token enums/entities, Wayfinder [002]               | `PRODUCT.md`, `README.md`      | `CONTEXT.md` auth claim stale.                          |
| Architecture/seams                        | Code/bootstrap + `ARCHITECTURE.md` + Wayfinder [001][003]-[010]           | `README.md`                    | `ARCHITECTURE.md` has stale auth/tooling/status notes.  |
| Engineering norms                         | `CODING_STANDARDS.md`, `SENIOR-DEV-RULES.md`, `DESLOP.md`                 | `AGENTS.md`                    | Standards include aspirational “not yet true” guidance. |
| Commands/CI/gates                         | `package.json`, `.github/workflows/ci.yml`, compose/config, measured runs | `AGENTS.md`                    | CI references missing `deps:circular`/`fallow` scripts. |
| Env/setup/runtime                         | `apps/api/.env.example`, `docker-compose*.yml`, `env.md`, runbooks        | `README.md`                    | Port/URL/default drift across docs/modes.               |
| Messaging/pipeline/providers/integrations | Wayfinder [006][009] + code                                               | snapshots/audits               | Behavior spread across overlapping paths.               |
| Data model/migrations                     | Wayfinder [007] + `data-source.ts`/entities/migrations                    | `ARCHITECTURE.md`              | Registration/retention/erasure gaps noted.              |
| Authn/authz/identity                      | Wayfinder [008] + `main.ts`/auth modules                                  | `CONTEXT.md`/`ARCHITECTURE.md` | Hybrid stacks and guard/doc drift.                      |
| Web app                                   | Wayfinder [005] + `apps/web` code                                         | `README.md`                    | Under-documented in top-level docs.                     |

**Precedence:** code + CI + migrations + measured output > Wayfinder evidence > intent docs (`CONTEXT/ARCHITECTURE/PRODUCT`) > snapshots/task analyses > README examples.

---

## 5. Stale, missing, and contradictory documentation

### High-impact

- **Auth drift:** `CONTEXT.md` and `ARCHITECTURE.md` deny Better Auth; code mounts `betterAuthHandler` at `/api/auth` (`apps/api/src/main.ts`, `modules/auth/better-auth.ts`) and uses hybrid identity flows (Wayfinder [008]).
- **Rule/docs availability drift:** `AGENTS.md` claims `.agents/rules/ponytail.mdc` and related rule state inconsistent with missing `.agents/.cursor` directories.
- **CI/script drift:** CI runs `deps:circular` and `fallow` but root `package.json` lacks them.
- **Env/port/topology drift:** README, `env.md`, env examples, and compose files describe conflicting defaults/URLs/ports.
- **README contract drift:** sample send payloads/auth flows may not match current DTO/controller surfaces (see Wayfinder [002][006]).
- **Baseline/status drift:** `AGENTS.md` and `ARCHITECTURE.md` disagree on known failures/state; snapshots (`ntfy-*`, `notifkit-sanarwa.md`) are time-bound.

### Missing

- Durable onboarding entrypoint (now added as `docs/ONBOARDING.md`), consolidated auth guide, authoritative contributor API contract index, maintained baseline/status section with date+commit, ADR/history for dual seams, and committed/tracked instruction docs.

### Overlaps

- Product/feature narratives, gap/status tracking, env/setup instructions, domain vocabulary, and “known state” repeated across multiple docs with divergence.

---

## 6. Durable onboarding artifact (produced)

- **Path:** `docs/ONBOARDING.md`
- **Purpose:** curated contributor entrypoint and source-of-truth index; summarizes domain, architecture, local env matrix, gates/baseline caveats, key flows/extension points, known drift/hotspots, and maintenance protocol.
- **Relationship to Wayfinder:** links to `docs/wayfinder/MAP-001-whole-repo-understanding.md` and tickets [001]–[011] for evidence/detail; does not replace them.
- **Content discipline:** marks verified vs inferred/stale/unmeasured claims; uses precedence rules (code/CI/measured > docs).

---

## 7. Recommended follow-ups (scoped, not all performed)

1. **P0:** Correct `CONTEXT.md`/`ARCHITECTURE.md`/relevant README sections for actual auth model and API/runtime facts (point to [008], [003], [006]).
2. **P0:** Repair `AGENTS.md` factual drift (rule/skill/file tracking claims, compose tracking note, CI/script status, dated baseline guidance).
3. **P1:** Resolve CI/script mismatch (`deps:circular`, `fallow`) by adding scripts or updating `.github/workflows/ci.yml` and docs together.
4. **P1:** Normalize env/setup docs into one authoritative matrix aligned with compose and web dev config.
5. **P1:** Reconcile README examples with verified contracts or label as illustrative and link to SDK/endpoint-drift docs.
6. **P2:** Mark snapshot docs (`ntfy-sanarwa.md`, `NTFY-SARAWA-SUMMARY.md`, `notifkit-sanarwa.md`, task notes) as dated/non-canonical.
7. **P2:** Commit critical untracked instruction docs in git to prevent loss (change-management decision).

---

## 8. Maintenance guidance

- Keep `docs/ONBOARDING.md` as the single contributor entrypoint; link from `README.md`/`AGENTS.md` when appropriate.
- Update onboarding in the same change when touching: auth/bootstrap/routing, env/compose/ports, scripts/CI, provider/channel/billing semantics, schema/migrations, or key send/identity flows.
- Require `Last verified` metadata and date/commit-scoped baseline claims for volatile sections.
- Treat Wayfinder tickets as appendable evidence; promote stable conclusions into onboarding and intent docs deliberately.
- Review question for PRs: “What docs become stale because of this diff?” (especially auth, tenancy, delivery, billing, migrations, env, CI).
