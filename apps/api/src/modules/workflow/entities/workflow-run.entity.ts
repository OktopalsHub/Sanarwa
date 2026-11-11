import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../common/database/entities/base.entity";

export type WorkflowRunStatus =
  | "running"
  | "waiting"
  | "waiting_for_event"
  | "completed"
  | "failed"
  | "cancelled";

@Entity("workflow_runs")
@Index(["tenantId", "workflowId", "status"])
@Index(["tenantId", "status"])
export class WorkflowRun extends BaseEntity {
  @Column({ name: "tenant_id" })
  tenantId: string;

  @Column({ name: "workflow_id" })
  workflowId: string;

  @Column({ type: "varchar", length: 32, default: "running" })
  status: WorkflowRunStatus;

  @Column({ type: "int", name: "current_step", default: 0 })
  currentStep: number;

  @Column({ type: "jsonb", default: () => "'{}'" })
  context: Record<string, unknown>;

  @Column({ type: "jsonb", default: () => "'{}'" })
  execution: Record<string, unknown>;

  @Column({ type: "varchar", length: 255, nullable: true, name: "wait_event" })
  waitEvent?: string | null;

  @Column({ type: "timestamp", nullable: true, name: "wait_until" })
  waitUntil?: Date | null;

  @Column({ type: "text", nullable: true, name: "error_message" })
  errorMessage?: string | null;

  @Column({ type: "timestamp", nullable: true, name: "started_at" })
  startedAt?: Date | null;

  @Column({ type: "timestamp", nullable: true, name: "completed_at" })
  completedAt?: Date | null;
}
