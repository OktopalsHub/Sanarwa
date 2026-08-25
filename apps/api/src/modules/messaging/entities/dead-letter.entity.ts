import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum DeadLetterStatus {
  PENDING_REVIEW = "pending_review",
  UNDER_INVESTIGATION = "under_investigation",
  RESOLVED = "resolved",
  IGNORED = "ignored",
}

export enum DeadLetterType {
  NOTIFICATION = "notification",
  DELIVERY = "delivery",
  WEBHOOK = "webhook",
  SYSTEM = "system",
}

@Entity("dead_letters")
@Index(["tenantId", "status"])
@Index(["originalType", "status"])
@Index(["createdAt"])
export class DeadLetter {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "tenant_id" })
  @Index()
  tenantId: string;

  @Column({
    type: "enum",
    enum: DeadLetterType,
    name: "original_type",
  })
  originalType: DeadLetterType;

  @Column({ name: "original_id" })
  originalId: string;

  @Column({ type: "text", name: "failure_reason" })
  failureReason: string;

  @Column({ type: "timestamp", name: "failed_at" })
  failedAt: Date;

  @Column({ type: "int", name: "retry_count", default: 0 })
  retryCount: number;

  @Column({
    type: "enum",
    enum: DeadLetterStatus,
    default: DeadLetterStatus.PENDING_REVIEW,
  })
  status: DeadLetterStatus;

  @Column({ type: "json", name: "original_job_data", nullable: true })
  originalJobData?: any;

  @Column({ type: "json", name: "message_data", nullable: true })
  messageData?: any;

  @Column({ type: "json", name: "delivery_data", nullable: true })
  deliveryData?: any;

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: "text", nullable: true, name: "resolution_notes" })
  resolutionNotes?: string;

  @Column({ type: "uuid", nullable: true, name: "resolved_by" })
  resolvedBy?: string;

  @Column({ type: "timestamp", nullable: true, name: "resolved_at" })
  resolvedAt?: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
