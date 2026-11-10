import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { BounceType, DeliveryEventType } from "../enums/delivery-event-type.enum";

@Entity("delivery_events")
@Index(["tenantId", "messageId", "occurredAt"])
@Index(["tenantId", "deliveryId", "occurredAt"])
@Index(["provider", "providerMessageId"])
export class DeliveryEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "tenant_id" })
  @Index()
  tenantId: string;

  @Column({ type: "uuid", nullable: true, name: "message_id" })
  messageId?: string;

  @Column({ type: "uuid", nullable: true, name: "delivery_id" })
  deliveryId?: string;

  @Column({ type: "varchar", length: 20 })
  channel: NotificationChannel;

  @Column({ type: "varchar", length: 50 })
  provider: string;

  @Column({ type: "varchar", length: 32 })
  type: DeliveryEventType;

  @Column({ type: "varchar", length: 10, nullable: true, name: "bounce_type" })
  bounceType?: BounceType;

  @Column({ type: "varchar", length: 120, nullable: true, name: "reason_code" })
  reasonCode?: string;

  @Column({ type: "text", nullable: true })
  diagnostic?: string;

  @Column({ type: "text", nullable: true })
  url?: string;

  @Column({ type: "text", nullable: true, name: "user_agent" })
  userAgent?: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  ip?: string;

  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    name: "provider_event_id",
  })
  providerEventId?: string;

  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    name: "provider_message_id",
  })
  providerMessageId?: string;

  @Column({ type: "jsonb", default: {} })
  raw: Record<string, any>;

  @Column({ type: "timestamp", name: "occurred_at" })
  occurredAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
