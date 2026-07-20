import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { TenantMember } from '../tenant-member/entities/tenant-member.entity';
import { MessageDelivery } from './message-delivery.entity';

export enum MessageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SENT = 'sent',
  DELIVERED = 'delivered',
  PARTIALLY_DELIVERED = 'partially_delivered',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum MessageChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  WHATSAPP = 'whatsapp',
  VOICE = 'voice',
}

export interface MessageRecipient {
  id: string;
  email?: string;
  phone?: string;
  deviceToken?: string;
  whatsappNumber?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

// Export type alias for convenience
export type Recipient = MessageRecipient;

@Entity('messages')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
@Index(['scheduledAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'template_id' })
  templateId?: string;

  @Column({ type: 'json' })
  channels: MessageChannel[];

  @Column({ type: 'json' })
  recipients: MessageRecipient[];

  @Column({ type: 'json' })
  data: Record<string, any>;

  @Column({
    type: 'enum',
    enum: MessageStatus,
    default: MessageStatus.PENDING,
  })
  status: MessageStatus;

  @Column({
    type: 'enum',
    enum: MessagePriority,
    default: MessagePriority.NORMAL,
  })
  priority: MessagePriority;

  @Column({ type: 'timestamp', nullable: true, name: 'scheduled_at' })
  scheduledAt?: Date;

  @Column({ type: 'text', nullable: true })
  subject?: string;

  @Column({ type: 'text', nullable: true })
  content?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'int', default: 0, name: 'retry_count' })
  retryCount: number;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'delivered_at' })
  deliveredAt?: Date;

  @ManyToOne(() => TenantMember, (tenantMember) => tenantMember.createdMessages, { nullable: true })
  createdBy?: TenantMember;

  @OneToMany(() => MessageDelivery, (delivery) => delivery.message, {
    cascade: true,
  })
  deliveries: MessageDelivery[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
