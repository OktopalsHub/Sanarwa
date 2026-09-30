import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../database/entities/base.entity";
import { Project } from "../../project/entities/project.entity";
import { TenantMember } from "../../tenant-member/entities/tenant-member.entity";
import { Tenant } from "../../tenant/entities/tenant.entity";

export enum ApiKeyStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  REVOKED = "revoked",
}

export enum ApiKeyEnvironment {
  PRODUCTION = "production",
  DEVELOPMENT = "development",
}

@Entity("api_keys")
@Index(["keyHash"], { unique: true })
@Index(["keyPrefix"], { unique: true })
@Index(["projectId", "status"])
export class ApiKey extends BaseEntity {
  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "varchar", name: "key_hash" })
  keyHash: string;

  @Column({ type: "varchar", name: "key_prefix" })
  keyPrefix: string;

  @Column({
    type: "enum",
    enum: ApiKeyEnvironment,
    default: ApiKeyEnvironment.PRODUCTION,
  })
  environment: ApiKeyEnvironment;

  @Column({ type: "enum", enum: ApiKeyStatus, default: ApiKeyStatus.ACTIVE })
  status: ApiKeyStatus;

  @Column({ type: "json", default: '["notifications:send", "templates:read"]' })
  permissions: string[];

  @Column({ type: "json", nullable: true, name: "ip_whitelist" })
  ipWhitelist?: string[];

  @Column({ type: "timestamp", nullable: true, name: "expires_at" })
  expiresAt?: Date;

  @Column({ type: "timestamp", nullable: true, name: "last_used_at" })
  lastUsedAt?: Date;

  @Column({ type: "varchar", nullable: true, name: "last_used_ip" })
  lastUsedIp?: string;

  @Column({ type: "int", default: 0, name: "usage_count" })
  usageCount: number;

  @Column({ type: "int", default: 1000, name: "rate_limit_per_minute" })
  rateLimitPerMinute: number;

  @Column({ type: "int", default: 10000, name: "rate_limit_per_hour" })
  rateLimitPerHour: number;

  @Column({ type: "int", default: 100000, name: "rate_limit_per_day" })
  rateLimitPerDay: number;

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, unknown>;

  // Relationships - PROJECT-LEVEL API KEYS
  @ManyToOne(() => Project, (project) => project.apiKeys, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @Column({ type: "uuid", name: "project_id" })
  projectId: string;

  @ManyToOne(() => TenantMember, (tenantMember) => tenantMember.createdApiKeys, { nullable: true })
  @JoinColumn({ name: "created_by_id" })
  createdBy: TenantMember;

  @Column({ type: "uuid", nullable: true, name: "created_by_id" })
  createdById: string;

  // Virtual properties
  get tenant(): Tenant | undefined {
    return this.project?.tenant;
  }

  get tenantId(): string | undefined {
    return this.project?.tenant.id;
  }

  get isExpired(): boolean {
    return !!(this.expiresAt && this.expiresAt < new Date());
  }

  get isActive(): boolean {
    return this.status === ApiKeyStatus.ACTIVE && !this.isExpired;
  }
}
