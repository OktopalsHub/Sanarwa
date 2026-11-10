import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("idempotency_keys")
@Unique("idempotency_keys_tenant_key", ["tenantId", "key"])
export class IdempotencyKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId: string;

  @Column({ type: "varchar", length: 255 })
  key: string;

  @Column({ type: "varchar", length: 16, default: "pending" })
  status: "pending" | "complete";

  @Column({ type: "uuid", nullable: true, name: "message_id" })
  messageId?: string | null;

  @Column({ type: "jsonb", nullable: true })
  response?: Record<string, any> | null;

  @Column({ type: "timestamp", name: "expires_at" })
  expiresAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
