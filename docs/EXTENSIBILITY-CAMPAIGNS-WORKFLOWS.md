# Extensibility: Campaigns & Workflows

How to add future capabilities (segments, parallel steps, richer triggers, etc.) without
rewriting the backend. The current implementation is intentionally **additive and
type-discriminated**: new behavior is added as new `type` values/fields alongside existing
ones; existing rows and behavior keep working.

**Status (2026-11-10):** campaigns and workflows are durable and step-IR-complete for the
implemented set: `set`, `condition`/`branch`, `delay`/`wait`, `wait_for_event`, `send`,
`foreach` (sequential, nested) and `parallel` (sequential-emulated, `all`/`any`), plus
`trigger: "schedule"` per-definition cron. Segments beyond topics/lists and compensation
remain future work; this doc is the seam for them.

---

## Design principles

- **JSONB + discriminators.** `Campaign.audience`, `Campaign.schedule`, `Campaign.templates`,
  `Campaign.analytics`, `Workflow.steps`, `Workflow.metadata`, and `WorkflowRun.context` are
  flexible (json/jsonb). Behavior is selected by a `type` (and related keys), not by fixed
  columns per variant.
- **Add, don’t repurpose.** Introduce a new `type` (or a new optional field) for new
  behavior. Do not change the meaning of an existing type/value.
- **Fail closed / explicit on unknowns.** Unknown audience or step types throw a clear error
  today (`Unsupported audience.type…`, `Unknown or unsupported step type…`). When you add a
  type, implement it before exposing it; until then it stays rejected rather than silently
  misbehaving.
- **Durable state in the DB.** Runs persist status, cursor (`currentStep`), `context`,
  `waitEvent`/`waitUntil`; campaigns persist schedule/analytics/`nextRunAt`. New
  scheduling/step kinds should plug into this state rather than rely on in-memory progress.
- **No schema rewrite for most extensions.** New step/audience/schedule variants usually need
  only handler code (+ optional supporting tables for _new concepts_ like segments), not
  changes to existing columns.

---

## Campaigns — extension points

**Key files**

- `apps/api/src/modules/campaign/entities/campaign.entity.ts` — `audience`, `schedule`,
  `templates`, `analytics` (flexible), `type`, `status`.
- `apps/api/src/modules/campaign/campaign.service.ts` — dispatch, audience resolution,
  scheduling/follow-up, trigger handling.
- `apps/api/src/modules/campaign/campaign.module.ts` — imports (add deps a new resolver needs).
- `apps/api/src/modules/campaign/dto/create-campaign.dto.ts` — request shape (kept permissive).

### Current behavior (baseline)

- **Audience types:** `topic`, `topics` (union), `list`/`subscribers`
  (`subscriberIds`/`ids`/`addresses`), `subscriber`/`single` (`subscriberId`/`id`/`to`),
  `trigger`/`event` (ids supplied at dispatch/trigger time). `all` is rejected.
- **Types & scheduling:** `one_time` completes; `recurring` reschedules via interval fields
  (`schedule.everyMs`/`intervalMs`/`everyMinutes`/`everyHours`) + `schedule.nextRunAt` and
  `@Cron(EVERY_MINUTE) processDueCampaigns()`; `drip` advances `analytics.dripStep` with
  per-step `delayMs`/`afterMs` → `nextRunAt`; `triggered` auto-dispatches on
  `@OnEvent("campaign.trigger")` when `schedule.trigger`/`schedule.event`/`metadata.triggerEvent`
  matches (or `campaignId` is targeted).
- **Dispatch path:** `dispatch()` → resolve channels → resolve audience subscriber ids →
  resolve message (by drip step) → fan out via `UnifiedSendService` in chunks → compute
  follow-up (`resolveFollowUp`) → persist status/schedule/analytics.

### Adding a segment / richer audience (future)

Goal: target subscribers by attributes/behavior (e.g. a saved segment or filter), not just
explicit ids/topics.

1. **Define the audience shape (additive).** Pick a new `audience.type`, e.g.:
   - `segment`: `{ "type": "segment", "segmentId": "<id>" }` (references a stored segment), or
   - `filter`: `{ "type": "filter", "where": { ... } }` (inline criteria).
     Store any new config in `audience` (jsonb) — no entity column change required.

2. **Resolve it in one place.** Extend `CampaignService.resolveAudience(tenantId, audience, options)`:
   - add a branch for the new `type` that returns `string[]` subscriber ids (or addresses,
     consistent with existing usage).
   - inject the service/repository that can evaluate the segment/filter (add the provider to
     `CampaignModule.imports/providers` as needed). Keep resolution tenant-scoped.
   - respect safety: never implement an unbounded `all` blast; prefer paged/streamed
     resolution if segments can be large (the current fan-out chunks sends in batches of 50).

3. **(If needed) add a segment store.** For `segmentId`-based targeting, add a `segments`
   (and optional membership/definition) entity + module, and resolve ids from it. This is the
   _only_ likely schema addition for segments; the campaign row stays unchanged.

4. **Validation & API.** Keep `Create/UpdateCampaignDto` permissive for `audience` (object) so
   new shapes don’t require DTO churn; add explicit validation in the resolver/service if the
   shape is malformed. Document the new type in API docs/summary.

5. **Tests.** Add cases in `modules/campaign/test/` mocking the segment resolver to return ids
   and asserting fan-out/queued counts, mirroring the existing topic/list tests.

### Adding new schedule/trigger behavior (future)

- **New interval/cron semantics:** extend `repeatIntervalMs()` / `getNextRunAt()` (for
  computed intervals) or `resolveFollowUp()` (for post-dispatch state). For true cron
  expressions you’ll need a parser; store the expression in `schedule` and compute
  `nextRunAt`. `processDueCampaigns()` already dispatches anything whose `nextRunAt` is due.
- **Richer event triggers:** `onCampaignTrigger` matches `schedule.trigger`/`event` or
  `metadata.triggerEvent` (and `campaignId`). To support more predicates, filter inside the
  handler (or extract a matcher) before calling `dispatch()`; keep the emitted event name
  `campaign.trigger` stable or add new `@OnEvent` handlers additively.
- **Audience at trigger time:** `audience.type = "trigger"|"event"` already defers recipients
  to dispatch options; reuse this for event-supplied segments/ids.

---

## Workflows — extension points

**Key files**

- `apps/api/src/modules/workflow/entities/workflow.entity.ts` — `steps` (jsonb array),
  `trigger`, `status`, `metadata`.
- `apps/api/src/modules/workflow/entities/workflow-run.entity.ts` — `status`, `currentStep`,
  `context` (jsonb), `waitEvent`, `waitUntil`, timestamps, `errorMessage`.
- `apps/api/src/modules/workflow/workflow.service.ts` — execution engine
  (`advanceRun`/`executeStep`), wait resume (`processDueWaits`), signaling/start
  (`signal`/`startRun`).
- `apps/api/src/modules/workflow/workflow.module.ts` — imports (e.g. `NotificationsModule`
  for send; add deps new step types need).
- `apps/api/src/modules/workflow/dto/workflow.dto.ts` — request DTOs.

### Current behavior (baseline, 2026-11-10)

- **Step IR (typed, id-bearing).** `WorkflowStep` (in `entities/workflow.entity.ts`) is a
  TypeScript discriminated union: `set`, `condition`/`branch`, `delay`/`wait`,
  `wait_for_event`, `send`. Every step written through `POST|PATCH .../workflows` carries a
  stable `id` (`step_*`, generated at write time) and an optional `label` for UI display.
  Unknown types and malformed steps are rejected with a full error list at write time
  (`validateWorkflowSteps` in `workflow-steps.ts`) — nothing is silently persisted.
- **Step types:** `set`, `condition`/`branch`, `delay`/`wait`, `wait_for_event`, `send`,
  `foreach` (`itemsKey`, `as`, `indexAs`, `onError: fail|skip`, nested sub-steps, sequential),
  `parallel` (`branches: Step[][]`, `mode: all|any`, `onError: fail|skip`, sequential-emulated).
  `send` interpolates `{{dot.path}}` fields and honors per-sub-step `retry`.
  Branch refs are a **step `id` string** or a **numeric step index**, scoped per step
  array — targets cannot reference across a nested construct boundary. Unknown ids fail
  the run with an explicit `errorMessage` rather than silently falling through.
  Empty `foreach` arrays are a no-op; a non-array `itemsKey` fails the run.
  Per-construct progress is durable in `execution.frames` (jsonb on `workflow_runs`;
  legacy rows backfilled from `context._frames`), the `_`-prefixed context keys never
  reach the provider or the API.
- **`{{dot.path}}` interpolation.** `resolveString` walks nested paths (`{{user.address.city}}`)
  with prototype-pollution guards (`dotGet`); single-level lookup is not enough for a visual
  builder that lets you reference a nested variable from an earlier `set` step.
- **Context hygiene.** Internal engine state lives in the `workflow_runs.execution`
  jsonb column (`frames`, `retryStep`, `stepRetryCount`, `signalKeys`); rows written
  before that column existed fall back to the legacy `context._execution` shape.
  Internal engine keys are `_`-prefixed (`_retryStep`, `_stepRetryCount`,
  `_signalKeys`). They never reach the provider: `variables` sent to `UnifiedSendService` is
  `publicContext(run.context)` merged with the step's `variables` then `workflowRunId`.
  They also never leave the API: `listRuns`/`getRun`/`startRun`/`cancelRun` return a sanitized
  copy of the run (`_` keys stripped), while the persisted row keeps engine state intact.
- **Execution:** `advanceRun` loops steps while `running` (bounded per tick,
  `MAX_STEPS_PER_TICK=50`), persisting after each step. A run that exhausts the cap is not
  left as an orphaned `running` row — it is re-parked as `waiting` with `waitUntil=now` and
  `execution.retryStep` marking the current step, so `processDueWaits` re-enters it within a
  minute without skipping ahead. Outcomes: `next` (increment), `jump` (engine set `currentStep`),
  `parked` (wait persisted, stop), `failed`. `processDueWaits` (cron, every minute) resumes
  elapsed waits (re-runs same step for `retryStep`, else advances past delay) and fails
  timed-out event waits. `signal` resumes matching `waiting_for_event` runs (idempotent via
  `idempotencyKey` → `execution.signalKeys`), advances past the wait step, and can auto-start
  `trigger:"event"` definitions matching `metadata.event`.
- **Run state:** cursor = `currentStep`; accumulated data in `context` (internal keys prefixed
  `_`); parked waits use `status`/`waitUntil`/`waitEvent`. Engine execution state =
  `execution` (jsonb).

### Adding a new step type (general recipe)

1. **Choose the shape.** e.g. `{ "type": "my_step", ... }` stored in `steps[]` (jsonb). No
   schema change.
2. **Handle it in `executeStep(run, step)`.** Return:
   - `"next"` to increment `currentStep`,
   - `"jump"` if you set `run.currentStep` yourself (branching),
   - `"parked"` if you persisted a wait state and should stop now (resume later via
     `processDueWaits` or `signal`),
   - `"failed"` after setting `run.status/errorMessage/completedAt`.
3. **Persist any durable state in `run.context` / run columns.** Keep internal keys `_`-prefixed
   to avoid colliding with user context; clear transient per-step state on completion (see
   `clearStepRetry`).
4. **If it waits:** set `status` + `waitUntil`/`waitEvent` and ensure `processDueWaits` (or
   `signal`) knows how to resume it (note the existing `_retryStep === currentStep` rule:
   retries re-run the same step, delays advance past it).

### Parallel / foreach (implemented 2026-11-10)

Parallel and iteration need child-progress state beyond a single cursor. Implemented as
designed here; compensation remains future work.

- **IR:** `foreach`: `{ type: "foreach", itemsKey, as?, indexAs?, onError?, steps: [<steps>] }`;
  `parallel`: `{ type: "parallel", branches: [[<steps>], [<steps>]], mode: "all"|"any", onError? }`.
- **Progress lives in `execution.frames`** (jsonb on `workflow_runs`; legacy rows
  backfilled from `context._frames`): one frame per construct
  (kind, parent index, item/branch cursor, sub-step cursor, total, per-unit results, retry
  count, park kind). The engine is sequential-emulated — branch 0 runs to completion
  before branch 1; nested constructs nest up to 3 levels.
- **Waits inside constructs** park exactly like top-level waits; `processDueWaits`/`signal`
  resume them frame-aware. A `wait_for_event` timeout with `onError: "skip"` skips the
  current unit; `"fail"` fails the run.
- **Send retries inside constructs** use frame-local counters; `retryStep`/`stepRetryCount`
  stay top-level in `execution`.
- **`onError: "skip"`** records `results[i] = { status: "failed", error }` and continues.

Current shape (kept for reference, matches implementation):

- `foreach` iterates the array at `itemsKey` (dot-path, context) with the item bound as
  `context[as]`; `parallel` runs branches sequentially; both park like top-level waits.

Future:

- **Compensation**: an undo step type or failure-path interpretation of `executeStep`/
  `advanceRun` — model it explicitly rather than overloading `failed`.

### Per-definition cron triggers (implemented 2026-11-10)

- `trigger: "schedule"` with `metadata.schedule = { everyMinutes? | everyHours? | everyMs? |
  intervalMs?, nextRunAt? }` (minimum 60 s; fixed intervals). On create/update, the interval
  is normalized to `intervalMs` and `nextRunAt` is computed (honoring a caller-provided
  future `nextRunAt`).
- `processDueSchedules` (`@Cron(EVERY_MINUTE)`) finds active schedule definitions whose
  `nextRunAt <= now`, starts a run, and recomputes `nextRunAt` (+interval). The cursor lives
  in the `workflows.next_run_at` column (with the pre-split `metadata.schedule.nextRunAt` JSON
  mirror as fallback). Mirrors the campaign `processDueCampaigns` pattern. For cron expressions,
  add a cron-parser dependency later and swap `resolveScheduleIntervalMs`.
- `signal`/event auto-start stays additive (it already starts `trigger:"event"` defs whose
  `metadata.event` matches).

### Guardrails when extending

- Bound per-tick work (`MAX_STEPS_PER_TICK`) to avoid starving the process; long/parallel work
  should yield (park or requeue) rather than loop unbounded.
- Keep user-facing `context` clean: internal bookkeeping under `_` keys; clear it when a
  step/construct completes.
- Validate step/audience config at execution time and fail the run/dispatch with a clear
  `errorMessage`/exception rather than guessing.
- Add focused tests (`modules/workflow/test/`, `modules/campaign/test/`) per new type, mocking
  external sends/resolvers.

---

## Quick reference — where to add a `case`

| Want to add                      | Primary hook                                                             | State lives in                          | Schema change?                                                |
| -------------------------------- | ------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------- |
| Campaign segment/filter audience | `CampaignService.resolveAudience` (+ module deps)                        | `audience` (jsonb)                      | only if a segment store/entity is needed                      |
| Campaign schedule/trigger rule   | `repeatIntervalMs` / `resolveFollowUp` / `onCampaignTrigger`             | `schedule`, `analytics`                 | no (usually)                                                  |
| Workflow step type               | `WorkflowService.executeStep` (+ `processDueWaits`/`signal` if it parks) | `steps[]`, `run.context`, `wait*` cols  | no                                                            |
| Workflow parallel/foreach        | `executeStep` (or extracted handler) + `advanceRun` coordination         | `run.context._*` (or child-run rows)    | maybe (child-run/queue), not required for sequential-emulated |
| Workflow cron-triggered defs     | scheduler tick + `startRun` (cf. campaign `processDueCampaigns`)         | `workflow.metadata` / definition fields | maybe (next-run field)                                        |
