import { Column, Entity, Index, ManyToOne, OneToMany } from "typeorm";
import { TenantMemberRole, TenantMemberStatus } from "../../../common/enums";
import { BaseEntity } from "../../../database/entities/base.entity";
import { ApiKey } from "../../api-key/entities/api-key.entity";
import { Brand } from "../../brand/entities/brand.entity";
import { Configuration } from "../../configuration/entities/configuration.entity";
import { Invite } from "../../invite/entities/invite.entity";
import { Message } from "../../messaging/message.entity";
import { Project } from "../../project/entities/project.entity";
import { ProviderConfig } from "../../provider/provider-config.entity";
import { Template } from "../../template/template.entity";
import { Tenant } from "../../tenant/entities/tenant.entity";
import { User } from "../../user/entities/user.entity";
import { PushCertificate } from "../../push-certificates/entities/push-certificate.entity";

@Entity("tenant_members")
@Index(["tenantId", "userId"], { unique: true })
@Index(["status"])
export class TenantMember extends BaseEntity {
  @Column({
    type: "enum",
    enum: TenantMemberRole,
    default: TenantMemberRole.MEMBER,
  })
  role: TenantMemberRole;

  @Column({
    type: "enum",
    enum: TenantMemberStatus,
    default: TenantMemberStatus.ACTIVE,
  })
  status: TenantMemberStatus;

  // @Column({ type: 'json', nullable: true })
  // permissions?: string[];

  // Foreign key columns
  @Column({ type: "uuid" })
  tenantId: string;

  @Column({ type: "uuid" })
  userId: string;

  // Relationships
  @ManyToOne(() => Tenant, (tenant) => tenant.members)
  tenant: Tenant;

  @ManyToOne(() => User)
  user: User;

  @OneToMany(() => ApiKey, (apiKey) => apiKey.createdBy)
  createdApiKeys: ApiKey[];

  @OneToMany(() => Invite, (invite) => invite.invitedBy)
  sentInvites: Invite[];

  @OneToMany(() => Brand, (brand) => brand.createdBy)
  createdBrands: Brand[];

  @OneToMany(() => Project, (project) => project.createdBy)
  createdProjects: Project[];

  @OneToMany(() => Template, (template) => template.createdBy)
  createdTemplates: Template[];

  @OneToMany(() => ProviderConfig, (providerConfig) => providerConfig.createdBy)
  createdProviderConfigs: ProviderConfig[];

  @OneToMany(() => Configuration, (configuration) => configuration.createdBy)
  createdConfigurations: Configuration[];

  @OneToMany(() => Message, (message) => message.createdBy)
  createdMessages: Message[];

  @OneToMany(() => PushCertificate, (certificate) => certificate.createdBy)
  createdPushCertificates: PushCertificate[];
}
