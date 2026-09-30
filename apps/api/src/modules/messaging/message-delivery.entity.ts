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
import { Message, MessageChannel } from "./message.entity";

export enum MessageDeliveryStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  BOUNCED = "bounced",
  OPENED = "opened",
  CLICKED = "clicked",
  UNSUBSCRIBED = "unsubscribed",
}

// Export type alias for convenience
export type DeliveryStatus = MessageDeliveryStatus;

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

  @Column({
    type: "enum",
    enum: MessageChannel,
    enumName: "message_channel_enum",
  })
  channel: MessageChannel;

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

  @ManyToOne(() => Message, (message) => message.deliveries, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "messageId" })
  message: Message;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
