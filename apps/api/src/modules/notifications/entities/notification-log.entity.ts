import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * Minimal logging entity for notification transport
 * Only stores delivery tracking data, not content
 */
@Entity("notification_logs")
@Index(["tenantId", "createdAt"])
@Index(["trackingId"])
@Index(["channel", "status"])
export class NotificationLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "tracking_id", unique: true })
  trackingId: string;

  @Column()
  channel: "email" | "sms" | "push" | "whatsapp" | "webhook" | "in_app";

  @Column()
  to: string; // Destination (email, phone, device token, etc.)

  @Column()
  status: "queued" | "sent" | "delivered" | "failed" | "cancelled";

  @Column({ name: "tenant_id" })
  tenantId: string;

  @Column({ name: "project_id" })
  projectId: string;

  @Column({ name: "external_id", nullable: true })
  externalId?: string; // Provider's ID (Twilio SID, SendGrid ID, etc.)

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

  // Optional: Store minimal metadata for debugging (not content)
  @Column({ type: "jsonb", nullable: true })
  metadata?: {
    templateId?: string;
    priority?: string;
    retryCount?: number;
    webhookUrl?: string;
    messageId?: string;
    deliveryId?: string;
  };

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
