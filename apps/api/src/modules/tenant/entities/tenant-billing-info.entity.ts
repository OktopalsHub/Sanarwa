import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Tenant } from './tenant.entity';

@Entity('tenant_billing_info')
export class TenantBillingInfo extends BaseEntity {
  @Column({ type: 'varchar', length: 50, nullable: true })
  plan?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  billingEmail?: string;

  @Column({ type: 'json', nullable: true })
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };

  @Column({ type: 'varchar', length: 100, nullable: true })
  paymentMethod?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentStatus?: string;

  @Column({ type: 'timestamp', nullable: true })
  nextBillingDate?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  monthlyAmount?: number;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // Relationship
  @Column({ type: 'uuid', name: 'tenant_id', unique: true })
  tenantId: string;

  @OneToOne(() => Tenant, (tenant) => tenant.billingInfo, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
