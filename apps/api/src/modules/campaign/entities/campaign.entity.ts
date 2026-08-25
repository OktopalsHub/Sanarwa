import { Column, Entity, Index, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../database/entities/base.entity";
import { Tenant } from "../../tenant/entities/tenant.entity";
import { TenantMember } from "../../tenant-member/entities/tenant-member.entity";

export type CampaignType = "one_time" | "recurring" | "triggered" | "drip";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

@Entity("campaigns")
@Index(["tenantId", "status"])
export class Campaign extends BaseEntity {
  @Column({ name: "tenant_id" })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: "CASCADE" })
  tenant: Tenant;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "varchar", length: 32, default: "one_time" })
  type: CampaignType;

  @Column({ type: "varchar", length: 32, default: "draft" })
  status: CampaignStatus;

  @Column({ type: "jsonb", default: [] })
  channels: string[];

  @Column({ type: "jsonb", default: {} })
  audience: Record<string, unknown>;

  @Column({ type: "jsonb", default: {} })
  schedule: Record<string, unknown>;

  @Column({ type: "jsonb", default: [] })
  templates: Record<string, unknown>[];

  @Column({ type: "jsonb", default: {} })
  analytics: Record<string, unknown>;

  @Column({ name: "created_by", nullable: true })
  createdById?: string;

  @ManyToOne(() => TenantMember, { nullable: true })
  createdBy?: TenantMember;
}
