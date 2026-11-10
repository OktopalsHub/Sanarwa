import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";

@Entity("template_versions")
@Index(["templateId", "version"], { unique: true })
@Index(["templateId", "isActive"])
@Index(["createdAt"])
export class TemplateVersion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "template_id" })
  @Index()
  templateId: string;

  @Column({ name: "version", type: "int" })
  version: number;

  @Column({ name: "name", length: 255 })
  name: string;

  @Column({ name: "description", type: "text", nullable: true })
  description?: string;

  @Column({ name: "subject", type: "text", nullable: true })
  subject?: string;

  @Column({ name: "data", type: "text" })
  data: string;

  @Column({ name: "html_content", type: "text", nullable: true })
  htmlContent?: string;

  @Column({ name: "variables", type: "jsonb", default: {} })
  variables: Record<string, any>;

  @Column({ name: "channels", type: "jsonb", default: [] })
  channels: string[];

  @Column({ name: "metadata", type: "jsonb", nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: "is_active", default: false })
  isActive: boolean;

  @Column({ name: "created_by", length: 255, nullable: true })
  createdBy?: string;

  @Column({ name: "change_log", type: "text", nullable: true })
  changeLog?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
