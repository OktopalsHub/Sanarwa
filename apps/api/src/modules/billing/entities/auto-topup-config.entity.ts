import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Tenant } from "../../tenant/entities/tenant.entity";
import { TenantPaymentMethod } from "./tenant-payment-method.entity";

export enum TopupTrigger {
  THRESHOLD = "threshold",
  SCHEDULED = "scheduled",
  BOTH = "both",
}

export enum ScheduleFrequency {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
}

@Entity("auto_topup_configs")
export class AutoTopupConfig {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "tenant_id", unique: true })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;

  @Column({ default: true })
  enabled: boolean;

  @Column({
    type: "enum",
    enum: TopupTrigger,
    default: TopupTrigger.THRESHOLD,
  })
  trigger: TopupTrigger;

  @Column({ type: "int", nullable: true })
  thresholdAmount: number;

  @Column({ type: "int", nullable: true })
  topupAmount: number;

  @Column({
    type: "enum",
    enum: ScheduleFrequency,
    nullable: true,
  })
  scheduleFrequency: ScheduleFrequency;

  @Column({ type: "int", nullable: true })
  scheduledAmount: number;

  @Column({ type: "time", nullable: true })
  scheduleTime: string;

  @Column({ type: "int", nullable: true })
  scheduleDayOfWeek: number;

  @Column({ type: "int", nullable: true })
  scheduleDayOfMonth: number;

  @Column({ type: "timestamp", nullable: true })
  lastTriggered: Date;

  @Column({ type: "timestamp", nullable: true })
  nextScheduledRun: Date;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  maxMonthlySpend: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  currentMonthSpend: number;

  @Column({ type: "int", default: 1 })
  currentMonth: number;

  @Column({ type: "int", default: new Date().getFullYear() })
  currentYear: number;

  @Column({ type: "varchar", length: 64, nullable: true, name: "package_id" })
  packageId?: string;

  @Column({ type: "varchar", length: 8, nullable: true })
  currency?: string;

  @Column({ type: "uuid", nullable: true, name: "payment_method_id" })
  paymentMethodId?: string;

  @ManyToOne(() => TenantPaymentMethod, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "payment_method_id" })
  paymentMethod?: TenantPaymentMethod;

  @Column({ type: "varchar", length: 128, nullable: true, name: "setup_reference" })
  setupReference?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
