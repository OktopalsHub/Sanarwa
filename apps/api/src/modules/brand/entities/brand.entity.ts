import { Column, Entity, ManyToOne, OneToMany } from "typeorm";
import { BrandStatus } from "../../../common/enums";
import { WhiteLabelConfig } from "../../../common/interfaces";
import { BaseEntity } from "../../../database/entities/base.entity";
import { Project } from "../../project/entities/project.entity";
import { TenantMember } from "../../tenant-member/entities/tenant-member.entity";
import { Tenant } from "../../tenant/entities/tenant.entity";

@Entity("brands")
export class Brand extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  domain?: string;

  @Column({
    type: "enum",
    enum: BrandStatus,
    default: BrandStatus.ACTIVE,
  })
  status: BrandStatus;

  @Column({ nullable: true })
  logo?: string;

  @Column({ type: "varchar", length: 7, nullable: true, name: "primary_color" })
  primaryColor?: string;

  @Column({
    type: "varchar",
    length: 7,
    nullable: true,
    name: "secondary_color",
  })
  secondaryColor?: string;

  @Column({ name: "default_from_email", nullable: true })
  defaultFromEmail?: string;

  @Column({ name: "default_from_name", nullable: true })
  defaultFromName?: string;

  @Column({ name: "reply_to_email" })
  replyToEmail?: string;

  @Column({ type: "json", nullable: true, name: "white_label_config" })
  whiteLabelConfig?: WhiteLabelConfig;

  @Column({ type: "json", nullable: true, name: "email_settings" })
  emailSettings?: {
    signature?: string;
    footerText?: string;
    unsubscribeText?: string;
    trackingEnabled?: boolean;
  };

  @Column({ type: "json", nullable: true, name: "sms_settings" })
  smsSettings?: {
    defaultSenderId?: string;
    optOutKeywords?: string[];
    optInKeywords?: string[];
  };

  @Column({ type: "json", nullable: true, name: "social_links" })
  socialLinks?: {
    website?: string;
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, any>;

  @ManyToOne(() => TenantMember, (tenantMember) => tenantMember.createdBrands)
  createdBy: TenantMember;

  // Relationships
  @ManyToOne(() => Tenant, (tenant) => tenant.brands)
  tenant: Tenant;

  @OneToMany(() => Project, (project) => project.brand)
  projects: Project[];
}
