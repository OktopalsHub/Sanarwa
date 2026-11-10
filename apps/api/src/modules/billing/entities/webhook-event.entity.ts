import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export type WebhookEventStatus = "processing" | "processed" | "failed";

@Entity("webhook_events")
@Index(["provider", "eventId"], { unique: true })
export class WebhookEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 32 })
  provider: string;

  @Column({ name: "event_id", length: 255 })
  eventId: string;

  @Column({ name: "payload_hash", length: 64, nullable: true })
  payloadHash?: string;

  @Column({ length: 16, default: "processed" })
  status: WebhookEventStatus;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage?: string | null;

  @Column({ name: "attempt_count", type: "int", default: 1 })
  attemptCount: number;

  @Column({ name: "last_attempt_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  lastAttemptAt: Date;

  @CreateDateColumn({ name: "processed_at" })
  processedAt: Date;
}
