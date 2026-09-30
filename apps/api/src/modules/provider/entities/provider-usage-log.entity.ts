import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ProviderConfig } from "../provider-config.entity";

@Entity("provider_usage_logs")
export class ProviderUsageLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "provider_config_id" })
  providerConfigId: string;

  @Column({ type: "varchar", length: 50 })
  channel: string;

  @Column({ type: "int", name: "message_count" })
  messageCount: number;

  @Column({ type: "int", name: "successful_count" })
  successfulCount: number;

  @Column({ type: "int", name: "failed_count" })
  failedCount: number;

  @Column({ type: "decimal", precision: 10, scale: 4, name: "total_cost" })
  totalCost: number;

  @Column({ type: "decimal", precision: 10, scale: 4, name: "provider_cost" })
  providerCost: number;

  @Column({ type: "decimal", precision: 10, scale: 4, name: "infrastructure_cost" })
  infrastructureCost: number;

  @Column({ type: "int", name: "average_latency_ms" })
  averageLatencyMs: number;

  @Column({ type: "json", nullable: true, name: "error_breakdown" })
  errorBreakdown?: Record<string, number>;

  @Column({ type: "varchar", length: 3 })
  currency: string;

  @Column({ type: "timestamp", name: "period_start" })
  periodStart: Date;

  @Column({ type: "timestamp", name: "period_end" })
  periodEnd: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => ProviderConfig)
  @JoinColumn({ name: "provider_config_id" })
  providerConfig: ProviderConfig;
}
