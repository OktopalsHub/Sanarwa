import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

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

  @CreateDateColumn({ name: "processed_at" })
  processedAt: Date;
}
