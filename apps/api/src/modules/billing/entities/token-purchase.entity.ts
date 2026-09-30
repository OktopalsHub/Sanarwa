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
import { Subscription } from "./subscription.entity";

export enum TokenPurchaseStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export enum TokenPurchaseType {
  MANUAL = "manual",
  AUTO_TOPUP = "auto_topup",
  SCHEDULED = "scheduled",
  OVERAGE = "overage",
}

@Entity("token_purchases")
export class TokenPurchase {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;

  @Column({ type: "uuid", nullable: true, name: "subscription_id" })
  subscriptionId: string;

  @ManyToOne(() => Subscription, { nullable: true })
  @JoinColumn({ name: "subscription_id" })
  subscription: Subscription;

  @Column({ type: "int" })
  tokenAmount: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ type: "decimal", precision: 10, scale: 4 })
  pricePerToken: number;

  @Column({
    type: "enum",
    enum: TokenPurchaseStatus,
    default: TokenPurchaseStatus.PENDING,
  })
  status: TokenPurchaseStatus;

  @Column({
    type: "enum",
    enum: TokenPurchaseType,
    default: TokenPurchaseType.MANUAL,
  })
  type: TokenPurchaseType;

  @Column({ nullable: true })
  paymentIntentId: string; // Polar or Bachs payment reference

  @Column({ nullable: true })
  transactionReference: string;

  @Column({ type: "json", nullable: true })
  paymentMetadata: any;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
