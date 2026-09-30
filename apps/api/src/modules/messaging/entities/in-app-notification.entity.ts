import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { TenantMember } from "../../tenant-member/entities/tenant-member.entity";
import { Tenant } from "../../tenant/entities/tenant.entity";
import { User } from "../../user/entities/user.entity";

export enum InAppNotificationType {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  SUCCESS = "success",
  SYSTEM = "system",
  USER_ACTION = "user_action",
  MARKETING = "marketing",
}

export enum InAppNotificationStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  READ = "read",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

@Entity("in_app_notifications")
@Index(["userId", "status"])
@Index(["tenantId", "createdAt"])
@Index(["type", "status"])
@Index(["tenantId", "feedId"])
@Index(["subscriberId", "seen"])
@Index(["transactionId", "tenantId"])
export class InAppNotification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({
    type: "enum",
    enum: InAppNotificationType,
    default: InAppNotificationType.INFO,
  })
  type: InAppNotificationType;

  @Column({
    type: "enum",
    enum: InAppNotificationStatus,
    default: InAppNotificationStatus.PENDING,
  })
  status: InAppNotificationStatus;

  @Column({ type: "jsonb", nullable: true })
  data: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true, name: "template_id" })
  templateId?: string;

  @Column()
  category: string;

  @Column({ nullable: true, name: "action_url" })
  actionUrl?: string;

  @Column({ type: "jsonb", nullable: true })
  actions?: Array<{
    id: string;
    label: string;
    url?: string;
    action?: string;
    style?: "primary" | "secondary" | "danger";
  }>;

  @Column({ type: "timestamp", nullable: true, name: "scheduled_at" })
  scheduledAt?: Date;

  @Column({ type: "timestamp", nullable: true, name: "sent_at" })
  sentAt?: Date;

  @Column({ type: "timestamp", nullable: true, name: "delivered_at" })
  deliveredAt?: Date;

  @Column({ type: "timestamp", nullable: true, name: "read_at" })
  readAt?: Date;

  @Column({ type: "timestamp", nullable: true, name: "expires_at" })
  expiresAt?: Date;

  // World-class Novu parity fields
  @Column({ type: "uuid", nullable: true, name: "transaction_id" })
  transactionId?: string;

  @Column({ type: "varchar", default: "default", name: "feed_id" })
  feedId: string;

  @Column({ type: "boolean", default: false })
  seen: boolean;

  @Column({ type: "timestamp", nullable: true, name: "seen_at" })
  seenAt?: Date;

  @Column({ type: "boolean", default: false })
  archived: boolean;

  @Column({ type: "timestamp", nullable: true, name: "archived_at" })
  archivedAt?: Date;

  @Column({ type: "varchar", nullable: true, name: "subscriber_id" })
  subscriberId?: string;

  @Column({ type: "varchar", nullable: true, name: "priority" })
  priority?: string;

  @Column({ type: "varchar", nullable: true, name: "avatar" })
  avatar?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column({ type: "uuid", nullable: true, name: "user_id" })
  userId?: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId: string;

  @ManyToOne(() => TenantMember, { nullable: true })
  createdBy?: TenantMember;

  @Column({ type: "uuid", nullable: true, name: "created_by_id" })
  createdById?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
