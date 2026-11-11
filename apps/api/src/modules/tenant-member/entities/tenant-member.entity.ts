import { Column, Entity, Index, ManyToOne, OneToMany } from "typeorm";
import { TenantMemberRole, TenantMemberStatus } from "../../../common/enums";
import { BaseEntity } from "../../../common/database/entities/base.entity";
import type { ApiKey } from "../../api-key/entities/api-key.entity";
import type { Brand } from "../../brand/entities/brand.entity";
import type { Configuration } from "../../configuration/entities/configuration.entity";
import type { Invite } from "../../invite/entities/invite.entity";
import type { Message } from "../../messaging/message.entity";
import type { Project } from "../../project/entities/project.entity";
import type { ProviderConfig } from "../../provider/provider-config.entity";
import type { Template } from "../../template/template.entity";
import type { Tenant } from "../../tenant/entities/tenant.entity";
import type { User } from "../../user/entities/user.entity";
import type { PushCertificate } from "../../push-certificates/entities/push-certificate.entity";

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

  @Column({ type: "text", nullable: true, name: "name" })
  name?: string | null;

  @Column({ type: "text", nullable: true, name: "avatar" })
  avatar?: string | null;

  @Column({ type: "uuid" })
  tenantId: string;

  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne("Tenant", (tenant: Tenant) => tenant.members)
  tenant: Tenant;

  @ManyToOne("User")
  user: User;

  @OneToMany("ApiKey", (apiKey: ApiKey) => apiKey.createdBy)
  createdApiKeys: ApiKey[];

  @OneToMany("Invite", (invite: Invite) => invite.invitedBy)
  sentInvites: Invite[];

  @OneToMany("Brand", (brand: Brand) => brand.createdBy)
  createdBrands: Brand[];

  @OneToMany("Project", (project: Project) => project.createdBy)
  createdProjects: Project[];

  @OneToMany("Template", (template: Template) => template.createdBy)
  createdTemplates: Template[];

  @OneToMany("ProviderConfig", (providerConfig: ProviderConfig) => providerConfig.createdBy)
  createdProviderConfigs: ProviderConfig[];

  @OneToMany("Configuration", (configuration: Configuration) => configuration.createdBy)
  createdConfigurations: Configuration[];

  @OneToMany("Message", (message: Message) => message.createdBy)
  createdMessages: Message[];

  @OneToMany("PushCertificate", (certificate: PushCertificate) => certificate.createdBy)
  createdPushCertificates: PushCertificate[];
}
