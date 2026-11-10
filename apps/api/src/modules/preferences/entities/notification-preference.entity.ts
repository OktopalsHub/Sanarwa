import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";

@Entity("notification_preferences")
export class NotificationPreference {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId: string;

  @Column({ type: "varchar", length: 255, name: "subscriber_id" })
  subscriberId: string;

  @Column({ type: "varchar", length: 20 })
  channel: NotificationChannel;

  @Column({ type: "boolean", default: true })
  enabled: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
