import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { Project } from "../project/entities/project.entity";
import { TenantMember } from "../tenant-member/entities/tenant-member.entity";

export enum ProviderType {
  AWS_SES = "aws_ses",
  TERMII = "termii",
  TWILIO = "twilio",
  WHATSAPP = "whatsapp",
  WHATSAPP_BUSINESS = "whatsapp_business",
  SLACK = "slack",
  DISCORD = "discord",
  TELEGRAM = "telegram",
}

@Entity("provider_configs")
@Index(["projectId", "channel"])
@Index(["projectId", "isActive"])
@Unique(["projectId", "providerId", "channel"])
export class ProviderConfig {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "project_id" })
  @Index()
  projectId: string;

  @Column({ name: "provider_id" })
  providerId: string;

  @Column({ type: "varchar", length: 100, name: "provider_name" })
  providerName: string;

  @Column({ type: "varchar", length: 50, name: "provider_type" })
  providerType: string;

  @Column({ type: "varchar", length: 20 })
  channel: NotificationChannel;

  @Column({ type: "json" })
  config: Record<string, any>;

  @Column({ type: "int", default: 1 })
  priority: number;

  @Column({ type: "boolean", default: true, name: "is_active" })
  isActive: boolean;

  @Column({ type: "boolean", default: false, name: "is_default" })
  isDefault: boolean;

  @Column({ type: "json", nullable: true, name: "supported_countries" })
  supportedCountries?: string[];

  @Column({ type: "json", nullable: true, name: "rate_limits" })
  rateLimits?: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
  };

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, any>;

  @ManyToOne(() => Project, (project) => project.providerConfigs, {
    onDelete: "CASCADE",
  })
  project: Project;

  @ManyToOne(() => TenantMember, (tenantMember) => tenantMember.createdProviderConfigs)
  createdBy: TenantMember;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  get tenant() {
    return this.project?.tenant;
  }

  get tenantId(): string | undefined {
    return this.project?.tenant.id;
  }
}
