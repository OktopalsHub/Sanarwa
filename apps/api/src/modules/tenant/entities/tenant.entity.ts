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
import { BaseEntity } from "../../../common/database/entities/base.entity";
import { Brand } from "../../brand/entities/brand.entity";
import { Invite } from "../../invite/entities/invite.entity";
import { Project } from "../../project/entities/project.entity";
import type { Template } from "../../template/template.entity";
import { TenantMember } from "../../tenant-member/entities/tenant-member.entity";
import type { User } from "../../user/entities/user.entity";
import { PushCertificate } from "../../push-certificates/entities/push-certificate.entity";
import type { Webhook } from "../../webhook/entities/webhook.entity";
import type { TenantSettings } from "./tenant-settings.entity";

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

  @Column({ name: "owner_id" })
  ownerId: string;

  @ManyToOne("User", (user: User) => user.tenants)
  @JoinColumn({ name: "owner_id" })
  owner: User;

  @OneToOne("TenantSettings", (settings: TenantSettings) => settings.tenant, {
    cascade: true,
    nullable: true,
  })
  settings?: TenantSettings;

  @OneToMany(() => TenantMember, (member: TenantMember) => member.tenant)
  members: TenantMember[];

  @OneToMany(() => Project, (project: Project) => project.tenant)
  projects: Project[];

  @OneToMany(() => Invite, (invite: Invite) => invite.tenant)
  invites: Invite[];

  @OneToMany(() => Brand, (brand: Brand) => brand.tenant)
  brands: Brand[];

  @OneToMany("Template", (template: Template) => template.tenant)
  templates: Template[];

  @OneToMany(() => PushCertificate, (certificate: PushCertificate) => certificate.tenant)
  pushCertificates: PushCertificate[];

  @OneToMany("Webhook", (webhook: Webhook) => webhook.tenant)
  webhooks: Webhook[];
}
