import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';

export enum TopupTrigger {
  THRESHOLD = 'threshold',
  SCHEDULED = 'scheduled',
  BOTH = 'both',
}

export enum ScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('auto_topup_configs')
export class AutoTopupConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id', unique: true })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ default: true })
  enabled: boolean;

  @Column({
    type: 'enum',
    enum: TopupTrigger,
    default: TopupTrigger.THRESHOLD,
  })
  trigger: TopupTrigger;

  @Column({ type: 'int', nullable: true })
  thresholdAmount: number;

  @Column({ type: 'int', nullable: true })
  topupAmount: number;

  @Column({
    type: 'enum',
    enum: ScheduleFrequency,
    nullable: true,
  })
  scheduleFrequency: ScheduleFrequency;

  @Column({ type: 'int', nullable: true })
  scheduledAmount: number;

  @Column({ type: 'time', nullable: true })
  scheduleTime: string;

  @Column({ type: 'int', nullable: true })
  scheduleDayOfWeek: number;

  @Column({ type: 'int', nullable: true })
  scheduleDayOfMonth: number;

  @Column({ type: 'timestamp', nullable: true })
  lastTriggered: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextScheduledRun: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxMonthlySpend: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  currentMonthSpend: number;

  @Column({ type: 'int', default: 1 })
  currentMonth: number;

  @Column({ type: 'int', default: new Date().getFullYear() })
  currentYear: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
