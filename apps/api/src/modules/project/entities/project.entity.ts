import type { Template } from "../../template/template.entity";
import { Column, Entity, Index, ManyToOne, OneToMany, OneToOne } from "typeorm";
import { ProjectStatus } from "../../../common/enums";
import { BaseEntity } from "../../../common/database/entities/base.entity";
import type { ApiKey } from "../../api-key/entities/api-key.entity";
import type { Brand } from "../../brand/entities/brand.entity";
import type { ProviderConfig } from "../../provider/provider-config.entity";
import type { TenantMember } from "../../tenant-member/entities/tenant-member.entity";
import type { Tenant } from "../../tenant/entities/tenant.entity";
import type { PushCertificate } from "../../push-certificates/entities/push-certificate.entity";

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

  @Column({ type: "uuid" })
  tenantId: string;

  @ManyToOne("Tenant", (tenant: Tenant) => tenant.projects)
  tenant: Tenant;

  @ManyToOne("Brand", (brand: Brand) => brand.projects, { nullable: true })
  brand?: Brand;

  @ManyToOne("TenantMember", (tenantMember: TenantMember) => tenantMember.createdProjects)
  createdBy: TenantMember;

  @OneToMany("ApiKey", (apiKey: ApiKey) => apiKey.project)
  apiKeys: ApiKey[];

  @OneToMany("ProviderConfig", (providerConfig: ProviderConfig) => providerConfig.project)
  providerConfigs: ProviderConfig[];

  @OneToMany("Template", (template: Template) => template.project)
  templates: Template[];

  @OneToMany("PushCertificate", (certificate: PushCertificate) => certificate.project)
  pushCertificates: PushCertificate[];
}
