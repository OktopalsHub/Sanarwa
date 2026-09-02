import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Project } from "../project/entities/project.entity";
import { Tenant } from "../tenant/entities/tenant.entity";
import { TenantMember } from "../tenant-member/entities/tenant-member.entity";

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

  @Column({ type: "varchar", length: 50, default: "email" })
  channel: "email" | "sms" | "push" | "in_app" | "whatsapp" | "voice";

  @Column({ type: "text", nullable: true })
  subject?: string;

  @Column({ type: "text", nullable: true })
  content?: string;

  @Column({ type: "jsonb", nullable: true })
  data?: Record<string, any>; // per-channel: {html, text, pushTitle, whatsappTemplate, tts, etc}

  @Column({ type: "jsonb", nullable: true })
  variables?: string[]; // extracted {{var}}

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
