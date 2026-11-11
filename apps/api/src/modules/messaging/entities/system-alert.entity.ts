import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum AlertSeverity {
  CRITICAL = "critical",
}

export enum AlertStatus {
  ACTIVE = "active",
}

export enum AlertType {
  DEAD_LETTER = "dead_letter",
}

@Entity("system_alerts")
@Index(["tenantId", "status"])
@Index(["alertType", "severity"])
@Index(["createdAt"])
export class SystemAlert {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "tenant_id" })
  @Index()
  tenantId: string;

  @Column({
    type: "enum",
    enum: AlertType,
    name: "alert_type",
  })
  alertType: AlertType;

  @Column({
    type: "enum",
    enum: AlertSeverity,
  })
  severity: AlertSeverity;

  @Column({
    type: "enum",
    enum: AlertStatus,
    default: AlertStatus.ACTIVE,
  })
  status: AlertStatus;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: "json", nullable: true })
  recipients?: string[];

  @Column({ type: "text", nullable: true, name: "resolution_notes" })
  resolutionNotes?: string;

  @Column({ type: "uuid", nullable: true, name: "acknowledged_by_member_id" })
  acknowledgedByMemberId?: string;

  @Column({ type: "timestamp", nullable: true, name: "acknowledged_at" })
  acknowledgedAt?: Date;

  @Column({ type: "uuid", nullable: true, name: "resolved_by_member_id" })
  resolvedByMemberId?: string;

  @Column({ type: "timestamp", nullable: true, name: "resolved_at" })
  resolvedAt?: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
