import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/database/repositories';
import { Repository } from 'typeorm';
import { Invite } from './entities/invite.entity';

@Injectable()
export class InviteRepository extends BaseRepository<Invite> {
  constructor(
    @InjectRepository(Invite)
    private readonly inviteRepository: Repository<Invite>,
  ) {
    super(inviteRepository);
  }

  async findByToken(token: string): Promise<Invite | null> {
    return this.findOne({
      where: { token },
      relations: ['tenant', 'invitedBy'],
    });
  }

  async findByEmailAndTenant(
    email: string,
    tenantId: string,
  ): Promise<Invite | null> {
    return this.findOne({
      where: { email, tenant: { id: tenantId } },
      relations: ['tenant', 'invitedBy'],
    });
  }

  async findPendingInvitesByTenant(tenantId: string): Promise<Invite[]> {
    return this.find({
      where: { tenantId, status: 'pending' },
      relations: ['invitedBy'],
    });
  }
}
