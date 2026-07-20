import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum NotificationCenterStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived',
}

@Entity('notification_center')
@Index(['subscriberId', 'status'])
@Index(['subscriberId', 'createdAt'])
@Index(['tenantId', 'createdAt'])
export class NotificationCenterItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'subscriber_id' })
  @Index()
  subscriberId: string;

  @Column({ name: 'title', length: 255 })
  title: string;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'channel', length: 50 })
  channel: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: NotificationCenterStatus,
    default: NotificationCenterStatus.UNREAD,
  })
  status: NotificationCenterStatus;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt?: Date;

  @Column({ name: 'archived_at', type: 'timestamp', nullable: true })
  archivedAt?: Date;

  @Column({ name: 'action_url', length: 500, nullable: true })
  actionUrl?: string;

  @Column({ name: 'action_label', length: 100, nullable: true })
  actionLabel?: string;

  @Column({ name: 'image_url', length: 500, nullable: true })
  imageUrl?: string;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: 'template_id', length: 255, nullable: true })
  templateId?: string;

  @Column({ name: 'message_id', length: 255, nullable: true })
  messageId?: string;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
