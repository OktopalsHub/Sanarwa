import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { WABAConfig } from "./waba-config.entity";

@Entity("tenant_waba_configs")
@Index(["tenantId", "wabaId"], { unique: true })
@Index(["tenantId"])
@Index(["wabaId"])
export class TenantWABAConfig {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "tenant_id" })
  tenantId: string;

  @Column({ name: "waba_id" })
  wabaId: string;

  @ManyToOne(() => WABAConfig, (waba) => waba.tenantConfigs)
  @JoinColumn({ name: "waba_id" })
  waba: WABAConfig;

  @Column({ default: true, name: "is_active" })
  isActive: boolean;

  @Column({ type: "json", name: "usage_stats" })
  usage: {
    messagesSent: number;
    templatesUsed: number;
    totalCost: number;
    lastMessageAt?: Date;
    dailyMessages?: number;
    monthlyMessages?: number;
    templateBreakdown?: Record<string, number>;
    costBreakdown?: {
      messages: number;
      templates: number;
      total: number;
    };
  };

  @Column({ nullable: true, name: "access_token" })
  accessToken?: string;

  @Column({ nullable: true, name: "phone_number_id" })
  phoneNumberId?: string;

  @Column({ default: "PENDING" })
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";

  @Column({ default: "UNVERIFIED", name: "verification_status" })
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED";

  @Column({ nullable: true, name: "last_sync_at" })
  lastSyncAt?: Date;

  @CreateDateColumn({ name: "assigned_at" })
  assignedAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Helper methods
  recordMessage(cost: number = 0): void {
    this.usage.messagesSent++;
    this.usage.totalCost += cost;
    this.usage.lastMessageAt = new Date();

    this.usage.dailyMessages = (this.usage.dailyMessages || 0) + 1;
    this.usage.monthlyMessages = (this.usage.monthlyMessages || 0) + 1;
  }

  recordTemplate(templateName: string): void {
    this.usage.templatesUsed++;

    if (!this.usage.templateBreakdown) {
      this.usage.templateBreakdown = {};
    }
    this.usage.templateBreakdown[templateName] =
      (this.usage.templateBreakdown[templateName] || 0) + 1;
  }

  getAverageMessagesPerDay(): number {
    const daysSinceAssignment = Math.max(
      1,
      Math.floor((Date.now() - this.assignedAt.getTime()) / (1000 * 60 * 60 * 24)),
    );
    return this.usage.messagesSent / daysSinceAssignment;
  }

  getAverageCostPerMessage(): number {
    return this.usage.messagesSent > 0 ? this.usage.totalCost / this.usage.messagesSent : 0;
  }
}
