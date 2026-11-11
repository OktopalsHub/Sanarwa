import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import type { TenantWABAConfig } from "./tenant-waba-config.entity";

@Entity("waba_configs")
export class WABAConfig {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true })
  tenantId: string;

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
  isByop: boolean;

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

  @OneToMany("TenantWABAConfig", (config: TenantWABAConfig) => config.waba)
  tenantConfigs: TenantWABAConfig[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

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
