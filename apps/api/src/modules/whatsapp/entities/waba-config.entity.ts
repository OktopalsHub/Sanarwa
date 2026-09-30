import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { TenantWABAConfig } from "./tenant-waba-config.entity";
import { TenantWABAAssignment } from "./tenant-waba-assignment.entity";

@Entity("waba_configs")
export class WABAConfig {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true })
  tenantId: string; // If BYOP (tenant-owned)

  @Column()
  businessAccountId: string;

  @Column()
  accessToken: string;

  @Column()
  phoneNumberId: string;

  @Column()
  webhookVerifyToken: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isByop: boolean; // Tenant-owned vs platform-managed

  @Column({ default: "global" })
  region: string;

  @Column({ default: 0 })
  templateCount: number;

  @Column({ default: 6000 })
  maxTemplates: number;

  @Column({ nullable: true })
  lastUsedAt: Date;

  @Column("json", { nullable: true })
  metadata: {
    displayName?: string;
    description?: string;
    phoneNumber?: string;
    verificationStatus?: string;
    businessProfile?: any;
  };

  @OneToMany(() => TenantWABAConfig, (config) => config.waba)
  tenantConfigs: TenantWABAConfig[];

  @OneToMany(() => TenantWABAAssignment, (assignment) => assignment.waba)
  assignments: TenantWABAAssignment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods for ESU pattern (1 tenant per WABA)
  canCreateTemplate(): boolean {
    return this.isActive && this.templateCount < this.maxTemplates;
  }

  getTemplateUtilizationRate(): number {
    return (this.templateCount / this.maxTemplates) * 100;
  }

  getRemainingTemplateCapacity(): number {
    return this.maxTemplates - this.templateCount;
  }
}
