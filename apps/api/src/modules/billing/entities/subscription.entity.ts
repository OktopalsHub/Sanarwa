import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { TokenPurchase } from './token-purchase.entity';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  TRIALING = 'trialing',
}

export enum SubscriptionPlan {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
  PAY_AS_YOU_GO = 'pay_as_you_go',
}

export enum PaymentProvider {
  POLAR = 'polar',
  PAYSTACK = 'paystack',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.PAY_AS_YOU_GO,
  })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
  })
  paymentProvider: PaymentProvider;

  @Column({ nullable: true })
  externalSubscriptionId: string; // Polar or Paystack subscription ID

  @Column({ nullable: true })
  externalCustomerId: string; // Polar or Paystack customer ID

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  monthlyPrice: number;

  @Column({ type: 'int', nullable: true })
  includedTokens: number; // Monthly token allowance

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  overageRate: number; // Price per token over limit

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodStart: Date;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodEnd: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialEnd: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelAtPeriodEnd: boolean;

  @OneToMany(() => TokenPurchase, (purchase) => purchase.subscription)
  tokenPurchases: TokenPurchase[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}