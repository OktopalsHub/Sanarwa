import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Tenant } from '../../tenant/entities/tenant.entity';

export type WebhookEvent =
  | 'email.sent'
  | 'email.delivered'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked'
  | 'email.complained'
  | 'email.unsubscribed'
  | 'sms.sent'
  | 'sms.delivered'
  | 'sms.failed'
  | 'push.sent'
  | 'push.delivered'
  | 'push.failed'
  | 'whatsapp.sent'
  | 'whatsapp.delivered'
  | 'whatsapp.failed'
  | 'notification.bulk_completed';

@Entity('webhooks')
@Index(['tenantId'])
@Index(['active'])
export class Webhook extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name?: string;

  @Column({ type: 'varchar', length: 2048 })
  url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  secret?: string;

  @Column({ type: 'jsonb', default: [] })
  events: WebhookEvent[];

  @Column({ type: 'boolean', default: true })
  active: boolean;

  // Relationships
  @ManyToOne(() => Tenant, (tenant) => tenant.webhooks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}