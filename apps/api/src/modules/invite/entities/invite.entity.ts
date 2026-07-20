import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TenantMemberRole } from '../../../common/enums';
import { TenantMember } from '../../tenant-member/entities/tenant-member.entity';
import { Tenant } from '../../tenant/entities/tenant.entity';

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('invites')
@Index(['email', 'tenantId'], { unique: true })
@Index(['token'], { unique: true })
@Index(['status'])
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  token: string;

  @Column({
    type: 'enum',
    enum: InviteStatus,
    default: InviteStatus.PENDING,
  })
  status: InviteStatus;

  @Column({
    type: 'enum',
    enum: TenantMemberRole,
    default: TenantMemberRole.MEMBER,
  })
  role: TenantMemberRole;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  // Foreign key columns
  @Column({ type: 'uuid' })
  tenantId: string;

  // Relationships
  @ManyToOne(() => Tenant, (tenant) => tenant.invites, { onDelete: 'CASCADE' })
  tenant: Tenant;

  @ManyToOne(() => TenantMember, (tenantMember) => tenantMember.sentInvites)
  invitedBy: TenantMember;

  @Column({ type: 'timestamp', nullable: true, name: 'accepted_at' })
  acceptedAt?: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'declined_at' })
  declinedAt?: Date;

  @Column({ type: 'timestamp', name: 'invited_at' })
  invitedAt: Date;

}
