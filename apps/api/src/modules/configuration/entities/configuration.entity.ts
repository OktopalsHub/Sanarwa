import { TenantMember } from '../../tenant-member/entities/tenant-member.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

export enum ConfigurationScope {
  GLOBAL = 'global',
  TENANT = 'tenant',
  ENVIRONMENT = 'environment',
}

export enum ConfigurationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
}

@Entity('configurations')
@Index(['tenantId', 'key'], { unique: true })
@Index(['configType'])
@Index(['isActive'])
export class Configuration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'config_key', length: 255 })
  key: string;

  @Column({ name: 'config_value', type: 'jsonb' })
  value: any;

  @Column({ name: 'config_type', length: 50, default: 'general' })
  configType: string;

  @Column({ nullable: true, length: 500 })
  description?: string;

  @Column({ name: 'is_encrypted', default: false })
  isEncrypted: boolean;

  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'validation_schema', type: 'jsonb', nullable: true })
  validationSchema?: any;

  @Column({ name: 'default_value', type: 'jsonb', nullable: true })
  defaultValue?: any;

  @ManyToOne(() => TenantMember, (tenantMember) => tenantMember.createdConfigurations, { nullable: true })
  createdBy?: TenantMember;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Computed properties for convenience
  get scope(): ConfigurationScope {
    return this.tenantId
      ? ConfigurationScope.TENANT
      : ConfigurationScope.GLOBAL;
  }

  get scopeId(): string | undefined {
    return this.tenantId;
  }

  get environment(): string {
    return 'development'; // Default environment
  }

  get status(): ConfigurationStatus {
    return this.isActive
      ? ConfigurationStatus.ACTIVE
      : ConfigurationStatus.INACTIVE;
  }

  get isSecret(): boolean {
    return this.isEncrypted;
  }

}
