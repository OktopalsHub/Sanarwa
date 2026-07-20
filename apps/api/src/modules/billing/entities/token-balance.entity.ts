import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';

export enum TokenTransactionType {
  PURCHASE = 'purchase',
  USAGE = 'usage',
  REFUND = 'refund',
  BONUS = 'bonus',
  EXPIRY = 'expiry',
}

@Entity('token_balances')
@Index(['tenantId'])
export class TokenBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'bigint', default: 0 })
  totalTokens: number;

  @Column({ type: 'bigint', default: 0 })
  usedTokens: number;

  @Column({ type: 'bigint', default: 0 })
  availableTokens: number;

  @Column({ type: 'bigint', default: 0 })
  reservedTokens: number;

  @Column({ type: 'timestamp', nullable: true })
  lastUsage: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastPurchase: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('token_transactions')
@Index(['tenantId', 'createdAt'])
export class TokenTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    type: 'enum',
    enum: TokenTransactionType,
  })
  type: TokenTransactionType;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'bigint' })
  balanceAfter: number;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ nullable: true })
  referenceId: string;

  @CreateDateColumn()
  createdAt: Date;
}
