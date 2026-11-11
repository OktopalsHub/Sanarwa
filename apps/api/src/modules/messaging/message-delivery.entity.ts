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
import type { Message } from "./message.entity";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";

export enum MessageDeliveryStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  BOUNCED = "bounced",
  OPENED = "opened",
  CLICKED = "clicked",
  UNSUBSCRIBED = "unsubscribed",
  SKIPPED = "skipped",
}

export type DeliveryStatus = MessageDeliveryStatus;

export enum DeliveryTransportStatus {
  PENDING = "pending",
  SENT = "sent",
  FAILED = "failed",
  SKIPPED = "skipped",
}

export enum DeliveryEngagementStatus {
  UNKNOWN = "unknown",
  DELIVERED = "delivered",
  OPENED = "opened",
  CLICKED = "clicked",
  BOUNCED = "bounced",
  UNSUBSCRIBED = "unsubscribed",
  COMPLAINED = "complained",
  FAILED = "failed",
}

@Entity("message_deliveries")
@Index(["messageId", "status"])
@Index(["channel", "status"])
@Index(["providerId", "status"])
@Index(["createdAt"])
export class MessageDelivery {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "message_id" })
  @Index()
  messageId: string;

  @Column({ type: "uuid", name: "tenant_id" })
  @Index()
  tenantId: string;

  @Column({ type: "varchar", length: 20 })
  channel: NotificationChannel;

  @Column({ name: "provider_id" })
  providerId: string;

  @Column({ type: "varchar", length: 500 })
  recipient: string;

  @Column({
    type: "enum",
    enum: MessageDeliveryStatus,
    default: MessageDeliveryStatus.PENDING,
  })
  status: MessageDeliveryStatus;

  @Column({
    type: "enum",
    enum: DeliveryTransportStatus,
    name: "transport_status",
    default: DeliveryTransportStatus.PENDING,
  })
  transportStatus!: DeliveryTransportStatus;

  @Column({
    type: "enum",
    enum: DeliveryEngagementStatus,
    name: "engagement_status",
    default: DeliveryEngagementStatus.UNKNOWN,
  })
  engagementStatus!: DeliveryEngagementStatus;

  @Column({ type: "timestamp", name: "state_updated_at", default: () => "now()" })
  stateUpdatedAt!: Date;

  @Column({ name: "provider_message_id" })
  providerMessageId?: string;

  @Column({ type: "json", nullable: true, name: "provider_response" })
  providerResponse?: any;

  @Column({ type: "text", nullable: true, name: "error_message" })
  errorMessage?: string;

  @Column({ type: "int", default: 0, name: "retry_count" })
  retryCount: number;

  @Column({ type: "timestamp", nullable: true, name: "sent_at" })
  sentAt?: Date;

  @Column({ type: "timestamp", nullable: true, name: "delivered_at" })
  deliveredAt?: Date;

  @Column({ type: "timestamp", nullable: true, name: "opened_at" })
  openedAt?: Date;

  @Column({ type: "timestamp", nullable: true, name: "clicked_at" })
  clickedAt?: Date;

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, any>;

  @ManyToOne("Message", (message: Message) => message.deliveries, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "message_id" })
  message: Message;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

export function deriveDeliveryTransportStatus(
  status: MessageDeliveryStatus,
): DeliveryTransportStatus {
  switch (status) {
    case MessageDeliveryStatus.PENDING:
      return DeliveryTransportStatus.PENDING;
    case MessageDeliveryStatus.SKIPPED:
      return DeliveryTransportStatus.SKIPPED;
    case MessageDeliveryStatus.FAILED:
      return DeliveryTransportStatus.FAILED;
    case MessageDeliveryStatus.SENT:
    case MessageDeliveryStatus.DELIVERED:
    case MessageDeliveryStatus.OPENED:
    case MessageDeliveryStatus.CLICKED:
    case MessageDeliveryStatus.BOUNCED:
    case MessageDeliveryStatus.UNSUBSCRIBED:
      return DeliveryTransportStatus.SENT;
    default:
      return DeliveryTransportStatus.PENDING;
  }
}

export function deriveDeliveryEngagementStatus(
  status: MessageDeliveryStatus,
): DeliveryEngagementStatus {
  switch (status) {
    case MessageDeliveryStatus.DELIVERED:
      return DeliveryEngagementStatus.DELIVERED;
    case MessageDeliveryStatus.OPENED:
      return DeliveryEngagementStatus.OPENED;
    case MessageDeliveryStatus.CLICKED:
      return DeliveryEngagementStatus.CLICKED;
    case MessageDeliveryStatus.BOUNCED:
      return DeliveryEngagementStatus.BOUNCED;
    case MessageDeliveryStatus.UNSUBSCRIBED:
      return DeliveryEngagementStatus.UNSUBSCRIBED;
    case MessageDeliveryStatus.FAILED:
      return DeliveryEngagementStatus.FAILED;
    default:
      return DeliveryEngagementStatus.UNKNOWN;
  }
}

export function headlineStatusFromDeliveryState(
  transportStatus: DeliveryTransportStatus,
  engagementStatus: DeliveryEngagementStatus,
): MessageDeliveryStatus {
  if (engagementStatus === DeliveryEngagementStatus.CLICKED) return MessageDeliveryStatus.CLICKED;
  if (engagementStatus === DeliveryEngagementStatus.OPENED) return MessageDeliveryStatus.OPENED;
  if (engagementStatus === DeliveryEngagementStatus.UNSUBSCRIBED)
    return MessageDeliveryStatus.UNSUBSCRIBED;
  if (engagementStatus === DeliveryEngagementStatus.BOUNCED) return MessageDeliveryStatus.BOUNCED;
  if (engagementStatus === DeliveryEngagementStatus.DELIVERED)
    return MessageDeliveryStatus.DELIVERED;
  if (transportStatus === DeliveryTransportStatus.SKIPPED) return MessageDeliveryStatus.SKIPPED;
  if (
    transportStatus === DeliveryTransportStatus.FAILED ||
    engagementStatus === DeliveryEngagementStatus.FAILED
  ) {
    return MessageDeliveryStatus.FAILED;
  }
  if (transportStatus === DeliveryTransportStatus.SENT) return MessageDeliveryStatus.SENT;
  return MessageDeliveryStatus.PENDING;
}

export function resolveDeliveryStatus(
  delivery: Partial<MessageDelivery> & { status?: MessageDeliveryStatus },
): MessageDeliveryStatus {
  return headlineStatusFromDeliveryState(
    delivery.transportStatus ??
      deriveDeliveryTransportStatus(delivery.status ?? MessageDeliveryStatus.PENDING),
    delivery.engagementStatus ??
      deriveDeliveryEngagementStatus(delivery.status ?? MessageDeliveryStatus.PENDING),
  );
}

export function applyDeliveryState(
  delivery: Partial<MessageDelivery> & {
    status?: MessageDeliveryStatus;
    transportStatus?: DeliveryTransportStatus;
    engagementStatus?: DeliveryEngagementStatus;
  },
  patch: {
    status?: MessageDeliveryStatus;
    transportStatus?: DeliveryTransportStatus;
    engagementStatus?: DeliveryEngagementStatus;
  },
): void {
  if (patch.status !== undefined) {
    delivery.status = patch.status;
    delivery.transportStatus = deriveDeliveryTransportStatus(patch.status);
    delivery.engagementStatus = deriveDeliveryEngagementStatus(patch.status);
  }
  if (patch.transportStatus !== undefined) {
    delivery.transportStatus = patch.transportStatus;
  }
  if (patch.engagementStatus !== undefined) {
    delivery.engagementStatus = patch.engagementStatus;
  }
  if (patch.transportStatus !== undefined || patch.engagementStatus !== undefined) {
    delivery.status = headlineStatusFromDeliveryState(
      delivery.transportStatus ??
        deriveDeliveryTransportStatus(delivery.status ?? MessageDeliveryStatus.PENDING),
      delivery.engagementStatus ??
        deriveDeliveryEngagementStatus(delivery.status ?? MessageDeliveryStatus.PENDING),
    );
  }
  delivery.stateUpdatedAt = new Date();
}
