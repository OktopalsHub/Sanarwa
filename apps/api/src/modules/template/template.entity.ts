import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Project } from "../project/entities/project.entity";
import { Tenant } from "../tenant/entities/tenant.entity";
import { TenantMember } from "../tenant-member/entities/tenant-member.entity";

@Entity("templates")
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
  subject?: string;

  @Column({ type: "text", nullable: true })
  content?: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.templates)
  tenant: Tenant;

  @ManyToOne(() => Project, (project) => project.templates, { nullable: true })
  project?: Project;

  @ManyToOne(() => TenantMember, (member) => member.createdTemplates, {
    nullable: true,
  })
  createdBy?: TenantMember;
}
