import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Tenant } from './tenant.entity';
import { NotificationStoragePolicy } from '../../notifications/enums/notification-storage-policy.enum';

@Entity('tenant_settings')
export class TenantSettings extends BaseEntity {
  @Column({ type: 'boolean', default: true })
  emailNotificationsEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  twoFactorAuthRequired: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  timezone?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language?: string;

  @Column({
    type: 'varchar',
    length: 32,
    default: NotificationStoragePolicy.METADATA_ONLY,
    name: 'notification_storage_policy',
  })
  notificationStoragePolicy: NotificationStoragePolicy;

  @Column({ type: 'int', nullable: true, name: 'content_retention_days' })
  contentRetentionDays?: number;

  @Column({ type: 'json', nullable: true })
  customBranding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    customDomain?: string;
  };

  @Column({ type: 'json', nullable: true })
  retentionPolicy?: {
    logsRetentionDays?: number;
    auditLogsRetentionDays?: number;
    deletedDataRetentionDays?: number;
    notificationContentRetentionDays?: number;
    notificationMetadataRetentionDays?: number;
  };

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // Relationship
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @OneToOne(() => Tenant, (tenant) => tenant.settings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
