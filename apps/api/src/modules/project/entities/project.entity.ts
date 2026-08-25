import { Template } from "../../template/template.entity";
import { Column, Entity, Index, ManyToOne, OneToMany, OneToOne } from "typeorm";
import { ProjectStatus } from "../../../common/enums";
import { BaseEntity } from "../../../database/entities/base.entity";
import { ApiKey } from "../../api-key/entities/api-key.entity";
import { Brand } from "../../brand/entities/brand.entity";
import { ProviderConfig } from "../../provider/provider-config.entity";
import { TenantMember } from "../../tenant-member/entities/tenant-member.entity";
import { Tenant } from "../../tenant/entities/tenant.entity";
import { PushCertificate } from "../../push-certificates/entities/push-certificate.entity";

@Entity("projects")
@Index(["tenantId"])
@Index(["status"])
@Index(["tenantId", "name"], { unique: true })
export class Project extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({
    type: "enum",
    enum: ProjectStatus,
    default: ProjectStatus.ACTIVE,
  })
  status: ProjectStatus;

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, any>;

  // Foreign key columns
  @Column({ type: "uuid" })
  tenantId: string;

  // Relationships
  @ManyToOne(() => Tenant, (tenant) => tenant.projects)
  tenant: Tenant;

  @ManyToOne(() => Brand, (brand) => brand.projects, { nullable: true })
  brand?: Brand;

  @ManyToOne(() => TenantMember, (tenantMember) => tenantMember.createdProjects)
  createdBy: TenantMember;

  @OneToMany(() => ApiKey, (apiKey) => apiKey.project)
  apiKeys: ApiKey[];

  @OneToMany(() => ProviderConfig, (providerConfig) => providerConfig.project)
  providerConfigs: ProviderConfig[];

  @OneToMany(() => Template, (template) => template.project)
  templates: Template[];

  @OneToMany(() => PushCertificate, (certificate) => certificate.project)
  pushCertificates: PushCertificate[];
}
