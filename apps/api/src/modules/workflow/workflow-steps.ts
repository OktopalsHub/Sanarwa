import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import type { WorkflowStep } from "./entities/workflow.entity";

export const MAX_STEPS = 200;
/** How many foreach/parallel frames may nest below the top level. */
export const MAX_NEST_DEPTH = 3;
export const MAX_BRANCHES = 8;
const MAX_RETRY_ATTEMPTS = 10;
const MAX_RETRY_DELAY_MS = 24 * 60 * 60 * 1000;
const MAX_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_DELAY_MS = 30 * 24 * 60 * 60 * 1000;

const CHANNELS = new Set<string>(Object.values(NotificationChannel));
export const STEP_TYPES = [
  "set",
  "condition",
  "branch",
  "delay",
  "wait",
  "wait_for_event",
  "send",
  "foreach",
  "parallel",
] as const;

export type UnknownStep = Record<string, unknown>;

export type StepValidation = {
  steps: WorkflowStep[];
  errors: string[];
};

function isRecord(value: unknown): value is UnknownStep {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asFiniteNumber(value: unknown, fallback?: number): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback ?? null;
}

function newStepId(): string {
  return `step_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function resolveJumpRefs(
  raw: UnknownStep,
  errors: string[],
  where: string,
): { then?: string | number; else?: string | number } {
  const then = raw.then ?? raw.thenStep;
  const els = raw.else ?? raw.elseStep;
  const resolve = (ref: unknown, name: string): string | number | undefined => {
    if (ref === undefined || ref === null) return undefined;
    const numeric = asFiniteNumber(ref);
    if (numeric !== null && Number.isInteger(numeric) && numeric >= 0) return numeric;
    const id = asNonEmptyString(ref);
    if (id) return id;
    errors.push(`${where}.${name} must be a non-negative index or a step id string`);
    return undefined;
  };
  return { then: resolve(then, "then"), else: resolve(els, "else") };
}

function validateOnError(raw: UnknownStep, errors: string[], where: string): "fail" | "skip" {
  const onError = raw.onError === undefined ? "fail" : asNonEmptyString(raw.onError);
  if (onError !== "fail" && onError !== "skip") {
    errors.push(`${where}.onError must be "fail" or "skip"`);
    return "fail";
  }
  return onError;
}

function validateRetry(
  raw: UnknownStep,
  errors: string[],
  where: string,
): { attempts: number; delayMs: number } | undefined {
  if (raw.retry === undefined) return undefined;
  const retryRaw = raw.retry;
  if (!isRecord(retryRaw)) {
    errors.push(`${where}.retry must be an object { attempts, delayMs }`);
    return undefined;
  }
  let attempts = 0;
  let delayMs = 5000;
  if (retryRaw.attempts !== undefined) {
    const parsed = asFiniteNumber(retryRaw.attempts);
    if (parsed === null || parsed < 0 || parsed > MAX_RETRY_ATTEMPTS || !Number.isInteger(parsed)) {
      errors.push(`${where}.retry.attempts must be an integer between 0 and ${MAX_RETRY_ATTEMPTS}`);
    } else {
      attempts = parsed;
    }
  }
  if (retryRaw.delayMs !== undefined) {
    const parsed = asFiniteNumber(retryRaw.delayMs);
    if (parsed === null || parsed < 0 || parsed > MAX_RETRY_DELAY_MS) {
      errors.push(`${where}.retry.delayMs must be between 0 and ${MAX_RETRY_DELAY_MS}`);
    } else {
      delayMs = parsed;
    }
  }
  return { attempts, delayMs };
}

/**
 * Validates one step array (top level or nested inside foreach/parallel).
 * `prefix` builds readable error paths; jump targets must exist within the
 * same array.
 */
function validateStepArray(
  rawSteps: unknown,
  prefix: string,
  depth: number,
  errors: string[],
  stepsOut: WorkflowStep[],
  counter: { count: number },
): void {
  if (!Array.isArray(rawSteps)) {
    errors.push(`${prefix} must be an array of step objects`);
    return;
  }
  if (rawSteps.length === 0) {
    errors.push(`${prefix} must not be empty`);
    return;
  }

  for (let index = 0; index < rawSteps.length; index += 1) {
    const raw = rawSteps[index] as UnknownStep;
    const where = `${prefix}[${index}]`;
    if (!isRecord(raw)) {
      errors.push(`${where} must be an object`);
      continue;
    }

    counter.count += 1;
    const type = asNonEmptyString(raw.type);
    if (!type || !(STEP_TYPES as readonly string[]).includes(type)) {
      errors.push(
        `${where}.type must be one of ${STEP_TYPES.join(", ")} (got '${String(raw.type)}')`,
      );
      continue;
    }

    const id = asNonEmptyString(raw.id) ?? newStepId();
    const label = asNonEmptyString(raw.label) ?? undefined;

    if (stepsOut.some((step) => step.id === id)) {
      errors.push(`${where}.id '${id}' is duplicated`);
    }

    switch (type) {
      case "set": {
        if (!isRecord(raw.values)) {
          errors.push(`${where}.values must be an object`);
          break;
        }
        stepsOut.push({ id, label, type: "set", values: raw.values });
        break;
      }

      case "condition":
      case "branch": {
        const condRaw = raw.if;
        if (!isRecord(condRaw)) {
          errors.push(`${where}.if must be an object with key/equals|notEquals|exists`);
          break;
        }
        const hasKey = asNonEmptyString(condRaw.key) !== null;
        const hasExists = typeof condRaw.exists === "boolean";
        const hasEquals = Object.prototype.hasOwnProperty.call(condRaw, "equals");
        const hasNotEquals = Object.prototype.hasOwnProperty.call(condRaw, "notEquals");
        if (!hasKey && !hasExists) {
          errors.push(`${where}.if.key is required (or set if.exists)`);
        }
        if (!hasEquals && !hasNotEquals && !hasExists) {
          errors.push(`${where}.if needs equals, notEquals or exists`);
        }
        const refs = resolveJumpRefs(raw, errors, where);
        stepsOut.push({
          id,
          label,
          type,
          if: {
            key: asNonEmptyString(condRaw.key) ?? undefined,
            equals: condRaw.equals,
            notEquals: condRaw.notEquals,
            exists: typeof condRaw.exists === "boolean" ? condRaw.exists : undefined,
          },
          then: refs.then,
          else: refs.else,
        });
        break;
      }

      case "delay":
      case "wait": {
        const ms = asFiniteNumber(raw.ms ?? raw.durationMs, undefined);
        if (ms === null || ms <= 0 || ms > MAX_DELAY_MS) {
          errors.push(`${where} needs a positive delay (ms/durationMs) up to ${MAX_DELAY_MS}`);
          break;
        }
        stepsOut.push({ id, label, type, ms });
        break;
      }

      case "wait_for_event": {
        const event = asNonEmptyString(raw.event);
        if (!event) {
          errors.push(`${where}.event is required`);
          break;
        }
        let timeoutMs: number | undefined;
        if (raw.timeoutMs !== undefined) {
          const parsed = asFiniteNumber(raw.timeoutMs);
          if (parsed === null || parsed <= 0 || parsed > MAX_TIMEOUT_MS) {
            errors.push(`${where}.timeoutMs must be a positive number up to ${MAX_TIMEOUT_MS}`);
            break;
          }
          timeoutMs = parsed;
        }
        stepsOut.push({ id, label, type: "wait_for_event", event, timeoutMs });
        break;
      }

      case "send": {
        const to = asNonEmptyString(raw.to);
        const channelsRaw = raw.channels;
        const channels = Array.isArray(channelsRaw)
          ? channelsRaw.filter((ch): ch is string => typeof ch === "string")
          : [];
        const invalidChannels = channels.filter((ch) => !CHANNELS.has(ch));
        if (!to) {
          errors.push(
            `${where}.to is required — it supports {{dot.path}} interpolation from run context`,
          );
        }
        if (channels.length === 0) {
          errors.push(`${where}.channels must contain at least one of ${[...CHANNELS].join(", ")}`);
        }
        if (invalidChannels.length > 0) {
          errors.push(`${where}.channels has unsupported values: ${invalidChannels.join(", ")}`);
        }

        const templateId = asNonEmptyString(raw.templateId);
        const body = asNonEmptyString(raw.data);
        if (!templateId && !body) {
          errors.push(`${where} needs either templateId or data (the raw body)`);
        }

        const variables = isRecord(raw.variables) ? raw.variables : undefined;
        if (raw.variables !== undefined && !variables) {
          errors.push(`${where}.variables must be an object`);
        }

        const retry = validateRetry(raw, errors, where);

        stepsOut.push({
          id,
          label,
          type: "send",
          to: to ?? "",
          channels,
          templateId: templateId ?? undefined,
          subject: asNonEmptyString(raw.subject) ?? undefined,
          data: body ?? undefined,
          variables,
          retry,
        });
        break;
      }

      case "foreach": {
        if (depth >= MAX_NEST_DEPTH) {
          errors.push(`${where}: nesting is limited to ${MAX_NEST_DEPTH} foreach/parallel levels`);
          break;
        }
        const itemsKey = asNonEmptyString(raw.itemsKey);
        if (!itemsKey) {
          errors.push(`${where}.itemsKey is required (dot-path to the array in context)`);
          break;
        }
        const as = asNonEmptyString(raw.as) ?? "item";
        const indexAs = asNonEmptyString(raw.indexAs) ?? "itemIndex";
        const onError = validateOnError(raw, errors, where);
        const subSteps: WorkflowStep[] = [];
        validateStepArray(raw.steps, `${where}.steps`, depth + 1, errors, subSteps, counter);
        stepsOut.push({
          id,
          label,
          type: "foreach",
          itemsKey,
          as,
          indexAs,
          onError,
          steps: subSteps,
        });
        break;
      }

      case "parallel": {
        if (depth >= MAX_NEST_DEPTH) {
          errors.push(`${where}: nesting is limited to ${MAX_NEST_DEPTH} foreach/parallel levels`);
          break;
        }
        const mode = raw.mode === undefined ? "all" : asNonEmptyString(raw.mode);
        if (mode !== "all" && mode !== "any") {
          errors.push(`${where}.mode must be "all" or "any"`);
        }
        const onError = validateOnError(raw, errors, where);
        const branchesRaw = raw.branches;
        if (!Array.isArray(branchesRaw) || branchesRaw.length === 0) {
          errors.push(`${where}.branches must be a non-empty array of step arrays`);
          break;
        }
        if (branchesRaw.length > MAX_BRANCHES) {
          errors.push(`${where}.branches may not exceed ${MAX_BRANCHES} branches`);
        }
        const branches: WorkflowStep[][] = [];
        const limit = Math.min(branchesRaw.length, MAX_BRANCHES);
        for (let branchIndex = 0; branchIndex < limit; branchIndex += 1) {
          const subSteps: WorkflowStep[] = [];
          validateStepArray(
            branchesRaw[branchIndex],
            `${where}.branches[${branchIndex}]`,
            depth + 1,
            errors,
            subSteps,
            counter,
          );
          branches.push(subSteps);
        }
        stepsOut.push({
          id,
          label,
          type: "parallel",
          mode: mode === "any" ? "any" : "all",
          onError,
          branches,
        });
        break;
      }
    }
  }

  // Jump targets must exist (as index or step id) within this same array.
  const ids = new Set(stepsOut.map((step) => step.id));
  stepsOut.forEach((step, index) => {
    if (step.type !== "condition" && step.type !== "branch") return;
    const targets = [step.then, step.else];
    targets.forEach((ref, targetIndex) => {
      if (ref === undefined) return;
      const ok = typeof ref === "number" ? ref >= 0 && ref < stepsOut.length : ids.has(String(ref));
      if (!ok) {
        const name = targetIndex === 0 ? "then" : "else";
        errors.push(
          `${prefix}[${index}].${name} references '${String(ref)}', which is not a step index or id in this scope`,
        );
      }
    });
  });
}

/**
 * Validates the ordered step array from a write request and returns the
 * normalized steps: ids assigned where absent, jump refs kept as-is. Collects
 * every problem rather than throwing on the first one so the client gets an
 * actionable error list.
 */
export function validateWorkflowSteps(rawSteps: unknown): StepValidation {
  const errors: string[] = [];
  const steps: WorkflowStep[] = [];
  const counter = { count: 0 };

  validateStepArray(rawSteps, "steps", 0, errors, steps, counter);
  if (counter.count > MAX_STEPS) {
    errors.push(
      `steps must not contain more than ${MAX_STEPS} entries in total (got ${counter.count})`,
    );
  }

  return { steps, errors };
}

/** Removes engine-internal `_`-prefixed keys — those never reach the provider or the API. */
export function publicContext(
  context: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!isRecord(context)) return {};
  return Object.fromEntries(Object.entries(context).filter(([key]) => !key.startsWith("_")));
}

/** Dot-path lookup (`user.address.city`) with prototype-pollution guards. */
export function dotGet(context: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = context;
  for (const segment of segments) {
    if (segment === "__proto__" || segment === "constructor" || segment === "prototype") {
      return undefined;
    }
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

/**
 * Version of the step IR a workflow was written against. Bump when the step
 * shape changes in a way that is not purely additive; a future visual builder
 * reads this to know whether a row needs migration before rendering.
 */
export const CURRENT_STEP_SCHEMA_VERSION = 1;

/** Stamps schemaVersion=1 on write; tolerates missing it on existing rows. */
export function withSchemaVersion(metadata: Record<string, unknown>): Record<string, unknown> {
  const provided = Number(metadata.schemaVersion);
  if (Number.isFinite(provided) && provided > CURRENT_STEP_SCHEMA_VERSION) {
    throw new BadRequestException(
      `metadata.schemaVersion ${provided} is newer than the engine (${CURRENT_STEP_SCHEMA_VERSION}); upgrade the platform before writing this workflow`,
    );
  }
  return { ...metadata, schemaVersion: CURRENT_STEP_SCHEMA_VERSION };
}

/** Schedule interval fields, same vocabulary as campaign `schedule`. */
import { BadRequestException } from "@nestjs/common";

export const SCHEDULE_INTERVAL_KEYS = [
  "everyMs",
  "intervalMs",
  "everyMinutes",
  "everyHours",
] as const;
const MIN_INTERVAL_MS = 60_000;
const MAX_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export function resolveScheduleIntervalMs(schedule: Record<string, unknown>): number | undefined {
  const everyMs = Number(schedule.everyMs ?? schedule.intervalMs);
  if (Number.isFinite(everyMs) && everyMs > 0) {
    return Math.min(Math.max(Math.floor(everyMs), MIN_INTERVAL_MS), MAX_INTERVAL_MS);
  }
  const everyMinutes = Number(schedule.everyMinutes);
  if (Number.isFinite(everyMinutes) && everyMinutes > 0) {
    return Math.min(Math.floor(everyMinutes * 60_000), MAX_INTERVAL_MS);
  }
  const everyHours = Number(schedule.everyHours);
  if (Number.isFinite(everyHours) && everyHours > 0) {
    return Math.min(Math.floor(everyHours * 3_600_000), MAX_INTERVAL_MS);
  }
  return undefined;
}

/**
 * Validates and normalizes `metadata.schedule` for trigger=schedule definitions.
 * Returns the metadata to persist and the interval for the cron, or errors.
 */
export function normalizeScheduleMetadata(
  metadata: unknown,
  now: Date,
): { metadata: Record<string, unknown>; intervalMs: number; errors: [] } | { errors: string[] } {
  const errors: string[] = [];
  const meta = isRecord(metadata) ? { ...metadata } : {};
  const rawSchedule = meta.schedule;

  if (!isRecord(rawSchedule)) {
    errors.push(
      `trigger "schedule" requires metadata.schedule with one of ${SCHEDULE_INTERVAL_KEYS.join(", ")}`,
    );
    return { errors };
  }

  const schedule = { ...rawSchedule };
  const intervalMs = resolveScheduleIntervalMs(schedule);
  if (!intervalMs) {
    errors.push(
      `metadata.schedule must carry a positive interval: ${SCHEDULE_INTERVAL_KEYS.join(", ")} (everyMinutes: 60, for example)`,
    );
    return { errors };
  }

  let nextRunAt: string | undefined;
  const providedNext = asNonEmptyString(schedule.nextRunAt);
  if (providedNext) {
    const parsed = new Date(providedNext);
    if (Number.isNaN(parsed.getTime())) {
      errors.push("metadata.schedule.nextRunAt must be a valid ISO 8601 timestamp");
    } else if (parsed.getTime() > now.getTime()) {
      nextRunAt = parsed.toISOString();
    } else {
      // Past timestamps are reinterpreted as "first run at the next boundary".
      nextRunAt = new Date(now.getTime() + intervalMs).toISOString();
    }
  } else {
    nextRunAt = new Date(now.getTime() + intervalMs).toISOString();
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    metadata: { ...meta, schedule: { ...schedule, intervalMs, nextRunAt } },
    intervalMs,
    errors: [] as never[],
  };
}
