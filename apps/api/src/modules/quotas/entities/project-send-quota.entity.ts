import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Opt-in per-project send quota (burst protection). No row means the project is
 * unbounded; the tenant token wallet still handles cost/billing. One row per
 * project, counted across all channels.
 */
@Entity("project_send_quotas")
@Index("UQ_project_send_quotas_project", ["projectId"], { unique: true })
@Index(["tenantId"])
export class ProjectSendQuota {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "project_id" })
  projectId: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId: string;

  @Column({ type: "int" })
  limit: number;

  @Column({ type: "int", name: "window_seconds", default: 60 })
  windowSeconds: number;

  @Column({ name: "enabled", default: true })
  enabled: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
