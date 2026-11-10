import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("subscriber_quiet_hours")
export class SubscriberQuietHours {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId: string;

  @Column({ type: "varchar", length: 255, name: "subscriber_id" })
  @Index()
  subscriberId: string;

  @Column({ type: "boolean", default: true })
  enabled: boolean;

  @Column({ type: "varchar", length: 64, default: "UTC" })
  timezone: string;

  @Column({ type: "smallint", name: "start_minute", default: 1320 })
  startMinute: number;

  @Column({ type: "smallint", name: "end_minute", default: 420 })
  endMinute: number;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
