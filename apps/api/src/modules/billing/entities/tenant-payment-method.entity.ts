import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { BillingCurrency } from '../constants/token-packages';

export enum TenantPaymentMethodStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

@Entity('tenant_payment_methods')
export class TenantPaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 16 })
  provider: PaymentProvider;

  @Column({ type: 'varchar', length: 8 })
  currency: BillingCurrency;

  @Column({ name: 'external_customer_id', length: 255 })
  externalCustomerId: string;

  @Column({ name: 'external_payment_method_id', length: 255, nullable: true })
  externalPaymentMethodId?: string;

  @Column({ name: 'external_subscription_id', length: 255, nullable: true })
  externalSubscriptionId?: string;

  @Column({ name: 'card_brand', length: 32, nullable: true })
  cardBrand?: string;

  @Column({ name: 'card_last4', length: 4, nullable: true })
  cardLast4?: string;

  @Column({ name: 'card_exp_month', type: 'int', nullable: true })
  cardExpMonth?: number;

  @Column({ name: 'card_exp_year', type: 'int', nullable: true })
  cardExpYear?: number;

  @Column({ type: 'varchar', length: 16, default: TenantPaymentMethodStatus.ACTIVE })
  status: TenantPaymentMethodStatus;

  @Column({ default: false, name: 'is_default' })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
