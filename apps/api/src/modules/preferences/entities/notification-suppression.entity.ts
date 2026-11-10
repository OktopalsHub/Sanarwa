import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";

@Entity("notification_suppressions")
export class NotificationSuppression {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId: string;

  @Column({ type: "varchar", length: 500 })
  address: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  channel?: NotificationChannel;

  @Column({ type: "varchar", length: 32 })
  reason: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
