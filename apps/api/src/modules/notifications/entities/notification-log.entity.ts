import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";

@Entity("notification_logs")
@Index(["tenantId", "createdAt"])
@Index(["trackingId"])
@Index(["channel", "status"])
export class NotificationLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "tracking_id", unique: true })
  trackingId: string;

  @Column({ type: "varchar", length: 32 })
  channel: NotificationChannel;

  @Column()
  to: string;

  @Column()
  status: "queued" | "sent" | "delivered" | "failed" | "cancelled";

  @Column({ name: "tenant_id" })
  tenantId: string;

  @Column({ name: "project_id" })
  projectId: string;

  @Column({ name: "external_id", nullable: true })
  externalId?: string;

  @Column({ type: "text", nullable: true })
  error?: string;

  @Column({ type: "timestamp", nullable: true, name: "scheduled_at" })
  scheduledAt?: Date;

  @Column({ type: "timestamp", nullable: true, name: "sent_at" })
  sentAt?: Date;

  @Column({ type: "timestamp", nullable: true, name: "delivered_at" })
  deliveredAt?: Date;

  @Column({ type: "timestamp", nullable: true, name: "failed_at" })
  failedAt?: Date;

  @Column({ type: "jsonb", nullable: true })
  metadata?: {
    templateId?: string;
    priority?: string;
    retryCount?: number;
    webhookUrl?: string;
    messageId?: string;
    deliveryId?: string;
    projectId?: string;
    storagePolicy?: string;
    brandId?: string;
  };

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
