import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DevicePlatform, PushProvider } from '../enums/device-platform.enum';

@Entity('device_registrations')
@Index(['subscriberId', 'tenantId'])
@Index(['deviceToken', 'subscriberId', 'tenantId'], { unique: true })
@Index(['platform', 'isActive'])
@Index(['provider', 'isActive'])
export class DeviceRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subscriber_id' })
  @Index()
  subscriberId: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'device_token', length: 500 })
  @Index()
  deviceToken: string;

  @Column({
    type: 'enum',
    enum: DevicePlatform,
    default: DevicePlatform.UNKNOWN,
  })
  platform: DevicePlatform;

  @Column({
    type: 'enum',
    enum: PushProvider,
    default: PushProvider.SNS,
  })
  provider: PushProvider;

  @Column({ name: 'app_bundle_id', nullable: true })
  appBundleId?: string;

  @Column({ type: 'jsonb', name: 'device_info', default: {} })
  deviceInfo: {
    model?: string;
    osVersion?: string;
    appVersion?: string;
    userAgent?: string;
    language?: string;
    timezone?: string;
  };

  @Column({ name: 'is_active', default: true })
  @Index()
  isActive: boolean;

  @Column({ name: 'last_seen', type: 'timestamp' })
  @Index()
  lastSeen: Date;

  @Column({ name: 'registered_at', type: 'timestamp' })
  registeredAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}