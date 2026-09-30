import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export type VoiceCallStatus = "initiated" | "connected" | "ended" | "failed";

@Entity("voice_calls")
@Index(["tenantId", "createdAt"])
@Index(["callControlId"], { unique: true })
@Index(["tenantId", "status"])
export class VoiceCall {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "tenant_id", type: "uuid" })
  tenantId: string;

  @Column({ name: "call_control_id", type: "varchar" })
  callControlId: string;

  @Column({ name: "phone_number", type: "varchar" })
  phoneNumber: string;

  @Column({ type: "varchar", default: "initiated" })
  status: VoiceCallStatus;

  @Column({ name: "tts_message", type: "text", nullable: true })
  ttsMessage?: string;

  @Column({ type: "varchar", nullable: true })
  hangupCause?: string;

  @Column({ type: "int", nullable: true })
  duration?: number;

  @Column({ type: "timestamp", name: "started_at" })
  startedAt: Date;

  @Column({ type: "timestamp", name: "ended_at", nullable: true })
  endedAt?: Date;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
