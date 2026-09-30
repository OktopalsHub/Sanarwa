import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  Unique,
} from "typeorm";
import { TenantStatus } from "../../../common/enums";
import { TenantQuotas, TenantUsage } from "../../../common/interfaces";
import { BaseEntity } from "../../../database/entities/base.entity";
import { Brand } from "../../brand/entities/brand.entity";
import { Invite } from "../../invite/entities/invite.entity";
import { Project } from "../../project/entities/project.entity";
import { Template } from "../../template/template.entity";
import { TenantMember } from "../../tenant-member/entities/tenant-member.entity";
import { User } from "../../user/entities/user.entity";
import { PushCertificate } from "../../push-certificates/entities/push-certificate.entity";
import { Webhook } from "../../webhook/entities/webhook.entity";
import { TenantBillingInfo } from "./tenant-billing-info.entity";
import { TenantSettings } from "./tenant-settings.entity";

@Entity("tenants")
@Unique(["subdomain"])
@Index(["status"])
export class Tenant extends BaseEntity {
  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({ type: "varchar", length: 50, unique: true })
  subdomain: string;

  @Column({ type: "varchar", length: 6, unique: true, name: "invite_code" })
  inviteCode: string;

  @Column({
    type: "enum",
    enum: TenantStatus,
    default: TenantStatus.ACTIVE,
  })
  status: TenantStatus;

  @Column({ type: "json" })
  quotas: TenantQuotas;

  @Column({ type: "json", nullable: true })
  usage?: TenantUsage;

  @Column({ type: "timestamp", nullable: true, name: "last_active_at" })
  lastActiveAt?: Date;

  @DeleteDateColumn({ nullable: true, type: "timestamp", name: "deleted_at" })
  deletedAt?: Date;

  // Relationships
  @Column({ name: "owner_id" })
  ownerId: string;

  @ManyToOne(() => User, (user) => user.tenants)
  @JoinColumn({ name: "owner_id" })
  owner: User;

  @OneToOne(() => TenantSettings, (settings) => settings.tenant, {
    cascade: true,
    nullable: true,
  })
  settings?: TenantSettings;

  @OneToOne(() => TenantBillingInfo, (billingInfo) => billingInfo.tenant, {
    cascade: true,
    nullable: true,
  })
  billingInfo?: TenantBillingInfo;

  @OneToMany(() => TenantMember, (member) => member.tenant)
  members: TenantMember[];

  @OneToMany(() => Project, (project) => project.tenant)
  projects: Project[];

  @OneToMany(() => Invite, (invite) => invite.tenant)
  invites: Invite[];

  @OneToMany(() => Brand, (brand) => brand.tenant)
  brands: Brand[];

  @OneToMany(() => Template, (template) => template.tenant)
  templates: Template[];

  @OneToMany(() => PushCertificate, (certificate) => certificate.tenant)
  pushCertificates: PushCertificate[];

  @OneToMany(() => Webhook, (webhook) => webhook.tenant)
  webhooks: Webhook[];
}
