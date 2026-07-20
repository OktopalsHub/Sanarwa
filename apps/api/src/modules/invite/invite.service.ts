import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { getPaginationSummary } from 'src/common/dto/pagination.dto';
import { AuthProvider } from 'src/common/enums';
import { PasswordService } from 'src/common/helpers/password.service';
import { IPaginatedData } from 'src/common/interfaces';
import { TenantMemberService } from '../tenant-member/tenant-member.service';
import { UserService } from '../user/user.service';
import { AcceptInviteResponseDto } from './dto/accept-invite-response.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { Invite, InviteStatus } from './entities/invite.entity';
import {
  InviteAcceptedEvent,
  InviteCreatedEvent,
  InviteDeclinedEvent,
} from './events/invite.events';
import { InviteRepository } from './invite.repository';

@Injectable()
export class InviteService {
  constructor(
    private readonly inviteRepository: InviteRepository,
    private readonly userService: UserService,
    private readonly tenantMemberService: TenantMemberService,
    private readonly eventEmitter: EventEmitter2,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Create a new invitation
   */
  async createInvite(
    tenantId: string,
    invitedById: string,
    createInviteDto: CreateInviteDto,
  ): Promise<Invite> {
    const { email, role } = createInviteDto;

    // Check if user is already a member of this tenant
    const existingMember = await this.tenantMemberService.findByUserEmail(
      tenantId,
      email,
    );
    if (existingMember) {
      throw new BadRequestException('User is already a member of this tenant');
    }

    // Check if there's already a pending invitation
    const existingInvite = await this.inviteRepository.findByEmailAndTenant(
      email,
      tenantId,
    );

    if (existingInvite) {
      throw new BadRequestException('Invitation already sent to this email');
    }

    // Generate unique token
    const token = this.generateInviteToken();

    // Set expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation
    const savedInvite = await this.inviteRepository.create({
      email,
      token,
      role,
      expiresAt,
      tenant: { id: tenantId },
      invitedBy: { id: invitedById },
    });

    // Emit event for email notification
    this.eventEmitter.emit(
      'invite.created',
      new InviteCreatedEvent(
        savedInvite.id,
        email,
        tenantId,
        token,
        invitedById,
      ),
    );

    return savedInvite;
  }

  /**
   * Accept an invitation
   */
  async acceptInvite(
    acceptInviteDto: AcceptInviteDto,
  ): Promise<AcceptInviteResponseDto> {
    const { token, firstName, lastName, password } = acceptInviteDto;

    // Find the invitation
    const invite = await this.inviteRepository.findByToken(token);

    if (!invite || invite.status !== InviteStatus.PENDING) {
      throw new NotFoundException('Invalid or expired invitation');
    }

    // Check if invitation has expired
    if (invite.expiresAt < new Date()) {
      await this.inviteRepository.update(invite.id, {
        status: InviteStatus.EXPIRED,
      });
      throw new BadRequestException('Invitation has expired');
    }

    // Check if user already exists
    let user = await this.userService.getByEmail(invite.email);

    if (!user) {
      // Prepare user data
      const userData: any = {
        email: invite.email,
        name: `${firstName} ${lastName}`.trim(),
      };

      // Handle authentication method based on password presence
      if (password) {
        // Email/password authentication flow
        const hashedPassword =
          await this.passwordService.hashPassword(password);
        userData.password = hashedPassword;
        userData.authProvider = AuthProvider.LOCAL;
      } else {
        // OAuth authentication flow - user will complete setup via OAuth
        userData.authProvider = AuthProvider.LOCAL; // Will be updated when they complete OAuth
        userData.password = null;
      }

      // Create new user account
      user = await this.userService.createUser(userData);
    } else {
      // User exists - update their profile if needed
      if (password && !user.password) {
        // User exists but doesn't have a password (was created via OAuth)
        // Allow them to set a password for local authentication
        const hashedPassword =
          await this.passwordService.hashPassword(password);
        await this.userService.updateUserInternal(user.id, {
          password: hashedPassword,
          name: user.name || `${firstName} ${lastName}`.trim(),
        });
        user = await this.userService.getById(user.id);
      } else if (!password && user.password) {
        // User has password but accepting via OAuth flow - just update profile
        await this.userService.updateUserInternal(user.id, {
          name: user.name || `${firstName} ${lastName}`.trim(),
        });
        user = await this.userService.getById(user.id);
      }
    }

    // Create tenant member
    const tenantMember = await this.tenantMemberService.createTenantMember(
      invite.tenant.id,
      {
        role: invite.role,
        user,
      },
    );

    // Update invitation status
    await this.inviteRepository.update(invite.id, {
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    });

    // Emit event
    this.eventEmitter.emit(
      'invite.accepted',
      new InviteAcceptedEvent(
        invite.id,
        user.id,
        invite.tenant.id,
        invite.role,
      ),
    );

    // Return clean response
    return {
      message: 'Invitation accepted successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.name.split(' ')[0] || '',
        lastName: user.name.split(' ').slice(1).join(' ') || '',
      },
      tenant: {
        id: invite.tenant.id,
        name: invite.tenant.name || 'Unknown Tenant',
      },
      membership: {
        role: tenantMember.role,
        joinedAt: tenantMember.createdAt,
      },
    };
  }

  /**
   * Decline an invitation
   */
  async declineInvite(token: string): Promise<void> {
    const invite = await this.inviteRepository.findByToken(token);

    if (!invite || invite.status !== InviteStatus.PENDING) {
      throw new NotFoundException('Invalid or expired invitation');
    }

    await this.inviteRepository.update(invite.id, {
      status: InviteStatus.DECLINED,
      declinedAt: new Date(),
    });

    // Emit event
    this.eventEmitter.emit(
      'invite.declined',
      new InviteDeclinedEvent(invite.id, invite.email, invite.tenant.id),
    );
  }

  /**
   * Get invitation by token
   */
  async getInviteByToken(token: string): Promise<Invite> {
    const invite = await this.inviteRepository.findByToken(token);

    if (!invite) {
      throw new NotFoundException('Invitation not found');
    }

    return invite;
  }

  /**
   * Get all invitations for a tenant with pagination
   */
  async getTenantInvites(
    tenantId: string,
    query?: any,
  ): Promise<IPaginatedData<Partial<Invite>>> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;

    const queryBuilder = this.inviteRepository
      .createQueryBuilder('invite')
      .leftJoin('invite.invitedBy', 'invitedBy')
      .leftJoin('invitedBy.user', 'inviterUser')
      .select([
        'invite.id',
        'invite.email',
        'invite.role',
        'invite.status',
        'invite.expiresAt',
        'invite.createdAt',
        'invite.acceptedAt',
        'invite.declinedAt',
        'invitedBy.id',
        'inviterUser.id',
        'inviterUser.email',
        'inviterUser.name',
      ])
      .where('invite.tenantId = :tenantId', { tenantId })
      .orderBy('invite.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [invites, total] = await queryBuilder.getManyAndCount();

    // Transform to only include necessary fields
    const sanitizedInvites = invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      invitedAt: invite.invitedAt,
      acceptedAt: invite.acceptedAt,
      declinedAt: invite.declinedAt,
      invitedBy: invite.invitedBy?.user
        ? {
            id: invite.invitedBy.user.id,
            email: invite.invitedBy.user.email,
            fullName: invite.invitedBy.user.name || invite.invitedBy.user.email,
          }
        : null,
    }));

    return getPaginationSummary(
      sanitizedInvites,
      total,
      { page, limit },
      'invites',
    );
  }

  /**
   * Cancel an invitation
   */
  async cancelInvite(tenantId: string, inviteId: string): Promise<void> {
    const invite = await this.inviteRepository.findById(inviteId, false, {
      tenant: { id: tenantId },
    });

    if (!invite) {
      throw new NotFoundException('Invitation not found');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Can only cancel pending invitations');
    }

    await this.inviteRepository.update(inviteId, {
      status: InviteStatus.CANCELLED,
    });
  }

  /**
   * Clean up expired invitations
   */
  async cleanupExpiredInvites(): Promise<void> {
    const expiredInvites = await this.inviteRepository.find({
      where: { status: InviteStatus.PENDING },
    });

    const now = new Date();
    const toUpdate = expiredInvites.filter((invite) => invite.expiresAt < now);

    for (const invite of toUpdate) {
      await this.inviteRepository.update(invite.id, {
        status: InviteStatus.EXPIRED,
      });
    }
  }

  /**
   * Generate a secure invitation token
   */
  private generateInviteToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
