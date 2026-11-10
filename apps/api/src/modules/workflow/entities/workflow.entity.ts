import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../common/database/entities/base.entity";

export type WorkflowStatus = "active" | "paused" | "archived";
export type WorkflowTrigger = "manual" | "event" | "schedule";

/**
 * Step targets are either the stable `id` of another step or the numeric index
 * of a step in the array. The engine resolves both; the visual builder should
 * always use ids so node reordering never breaks references.
 */
export type StepRef = string | number;

export interface WorkflowCondition {
  key?: string;
  equals?: unknown;
  notEquals?: unknown;
  exists?: boolean;
}

export interface WorkflowRetry {
  attempts?: number;
  delayMs?: number;
}

export interface SetStep {
  id?: string;
  label?: string;
  type: "set";
  values: Record<string, unknown>;
}

export interface ConditionStep {
  id?: string;
  label?: string;
  type: "condition" | "branch";
  if?: WorkflowCondition;
  then?: StepRef;
  else?: StepRef;
  thenStep?: StepRef;
  elseStep?: StepRef;
}

export interface DelayStep {
  id?: string;
  label?: string;
  type: "delay" | "wait";
  ms?: number;
  durationMs?: number;
}

export interface WaitForEventStep {
  id?: string;
  label?: string;
  type: "wait_for_event";
  event: string;
  timeoutMs?: number;
}

export interface SendStep {
  id?: string;
  label?: string;
  type: "send";
  to: string;
  channels: string[];
  templateId?: string;
  subject?: string;
  /** Raw body/HTML. `{{dot.path}}` placeholders interpolate from run context. */
  data?: string;
  /** Template variables; merged over the sanitized run context at send time. */
  variables?: Record<string, unknown>;
  retry?: WorkflowRetry;
}

export type NestedFailurePolicy = "fail" | "skip";

export interface ForeachStep {
  id?: string;
  label?: string;
  type: "foreach";
  /** Dot-path to the array in context, e.g. "users". */
  itemsKey: string;
  /** Context key the item is exposed under; default "item". */
  as?: string;
  /** Context key the zero-based item index is exposed under; default "itemIndex". */
  indexAs?: string;
  /** Sub-step failure: fail the run (default) or skip the item. */
  onError?: NestedFailurePolicy;
  steps: WorkflowStep[];
}

export interface ParallelStep {
  id?: string;
  label?: string;
  type: "parallel";
  /** "all" waits for every branch; "any" completes when the first branch succeeds. */
  mode: "all" | "any";
  /** Branch failure: fail the run (default) or record and continue other branches. */
  onError?: NestedFailurePolicy;
  branches: WorkflowStep[][];
}

export type WorkflowStep =
  | SetStep
  | ConditionStep
  | DelayStep
  | WaitForEventStep
  | SendStep
  | ForeachStep
  | ParallelStep;

@Entity("workflows")
@Index(["tenantId", "status"])
export class Workflow extends BaseEntity {
  @Column({ name: "tenant_id" })
  tenantId: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "varchar", length: 32, default: "manual" })
  trigger: WorkflowTrigger;

  @Column({ type: "varchar", length: 32, default: "active" })
  status: WorkflowStatus;

  /**
   * Ordered step IR. Every step written through the API carries a stable `id`
   * (generated at write time); jumps reference that id or a numeric index.
   */
  @Column({ type: "jsonb", default: () => "'[]'" })
  steps: WorkflowStep[];

  @Column({ type: "jsonb", default: () => "'{}'" })
  metadata: Record<string, unknown>;
}
