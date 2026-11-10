import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Project } from "../project/entities/project.entity";
import { Tenant } from "../tenant/entities/tenant.entity";
import { TenantMember } from "../tenant-member/entities/tenant-member.entity";
import { TemplateStatus } from "../../common/enums/template.enum";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { TemplateVariable } from "../../common/interfaces/template.interface";

@Entity("templates")
@Index(["tenantId", "channel"])
@Index(["tenantId", "name"])
export class Template {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  tenantId: string;

  @Column({ type: "uuid", nullable: true })
  projectId?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  name?: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "boolean", default: false })
  isDefault: boolean;

  @Column({ type: "varchar", length: 50, default: "email" })
  channel: NotificationChannel;

  @Column({ type: "text", nullable: true })
  subject?: string;

  @Column({ type: "text", nullable: true })
  data?: string;

  @Column({ type: "json", nullable: true })
  meta?: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  variables?: TemplateVariable[];

  @Column({ type: "enum", enum: TemplateStatus, default: TemplateStatus.DRAFT })
  status: TemplateStatus;

  @Column({ type: "int", default: 1 })
  version: number;

  @Column({ type: "uuid", nullable: true, name: "parent_template_id" })
  parentTemplateId?: string;

  @Column({ type: "jsonb", nullable: true, name: "channel_specific" })
  channelSpecific?: Record<string, any>;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.templates)
  tenant: Tenant;

  @ManyToOne(() => Project, (project) => project.templates, { nullable: true })
  project?: Project;

  @ManyToOne(() => TenantMember, (member) => member.createdTemplates, {
    nullable: true,
  })
  createdBy?: TenantMember;
}
