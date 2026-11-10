import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import * as crypto from "crypto";
import { getPaginationSummary } from "../../common/dto/pagination.dto";
import { AuthProvider } from "../../common/enums";
import { PasswordService } from "../../common/helpers/password.service";
import { IPaginatedData } from "../../common/interfaces";
import { TenantMemberService } from "../tenant-member/tenant-member.service";
import { UserService } from "../user/user.service";
import { AcceptInviteResponseDto } from "./dto/accept-invite-response.dto";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import { CreateInviteDto } from "./dto/create-invite.dto";
import { Invite, InviteStatus } from "./entities/invite.entity";
import {
  InviteAcceptedEvent,
  InviteCreatedEvent,
  InviteDeclinedEvent,
} from "./events/invite.events";
import { InviteRepository } from "./invite.repository";

@Injectable()
export class InviteService {
  constructor(
    private readonly inviteRepository: InviteRepository,
    private readonly userService: UserService,
    private readonly tenantMemberService: TenantMemberService,
    private readonly eventEmitter: EventEmitter2,
    private readonly passwordService: PasswordService,
  ) {}

  async createInvite(
    tenantId: string,
    invitedById: string,
    createInviteDto: CreateInviteDto,
  ): Promise<Invite> {
    const { email, role } = createInviteDto;

    const existingMember = await this.tenantMemberService.findByUserEmail(tenantId, email);
    if (existingMember) {
      throw new BadRequestException("User is already a member of this tenant");
    }

    const existingInvite = await this.inviteRepository.findByEmailAndTenant(email, tenantId);

    if (existingInvite) {
      throw new BadRequestException("Invitation already sent to this email");
    }

    const token = this.generateInviteToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const savedInvite = await this.inviteRepository.create({
      email,
      token,
      role,
      expiresAt,
      tenant: { id: tenantId },
      invitedBy: { id: invitedById },
    });

    this.eventEmitter.emit(
      "invite.created",
      new InviteCreatedEvent(savedInvite.id, email, tenantId, token, invitedById),
    );

    return savedInvite;
  }

  async acceptInvite(acceptInviteDto: AcceptInviteDto): Promise<AcceptInviteResponseDto> {
    const { token, firstName, lastName, password } = acceptInviteDto;

    const invite = await this.inviteRepository.findByToken(token);

    if (!invite || invite.status !== InviteStatus.PENDING) {
      throw new NotFoundException("Invalid or expired invitation");
    }

    if (invite.expiresAt < new Date()) {
      await this.inviteRepository.update(invite.id, {
        status: InviteStatus.EXPIRED,
      });
      throw new BadRequestException("Invitation has expired");
    }

    let user = await this.userService.getByEmail(invite.email);

    if (!user) {
      const userData: any = {
        email: invite.email,
        name: `${firstName} ${lastName}`.trim(),
      };

      if (password) {
        const hashedPassword = await this.passwordService.hashPassword(password);
        userData.password = hashedPassword;
        userData.authProvider = AuthProvider.LOCAL;
      } else {
        userData.authProvider = AuthProvider.LOCAL;
        userData.password = null;
      }

      user = await this.userService.createUser(userData);
    } else {
      if (password && !user.password) {
        const hashedPassword = await this.passwordService.hashPassword(password);
        await this.userService.updateUserInternal(user.id, {
          password: hashedPassword,
          name: user.name || `${firstName} ${lastName}`.trim(),
        });
        user = await this.userService.getById(user.id);
      } else if (!password && user.password) {
        await this.userService.updateUserInternal(user.id, {
          name: user.name || `${firstName} ${lastName}`.trim(),
        });
        user = await this.userService.getById(user.id);
      }
    }

    const tenantMember = await this.tenantMemberService.createTenantMember(invite.tenant.id, {
      role: invite.role,
      user,
    });

    await this.inviteRepository.update(invite.id, {
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    });

    this.eventEmitter.emit(
      "invite.accepted",
      new InviteAcceptedEvent(invite.id, user.id, invite.tenant.id, invite.role),
    );

    return {
      message: "Invitation accepted successfully",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.name.split(" ")[0] || "",
        lastName: user.name.split(" ").slice(1).join(" ") || "",
      },
      tenant: {
        id: invite.tenant.id,
        name: invite.tenant.name || "Unknown Tenant",
      },
      membership: {
        role: tenantMember.role,
        joinedAt: tenantMember.createdAt,
      },
    };
  }

  async declineInvite(token: string): Promise<void> {
    const invite = await this.inviteRepository.findByToken(token);

    if (!invite || invite.status !== InviteStatus.PENDING) {
      throw new NotFoundException("Invalid or expired invitation");
    }

    await this.inviteRepository.update(invite.id, {
      status: InviteStatus.DECLINED,
      declinedAt: new Date(),
    });

    this.eventEmitter.emit(
      "invite.declined",
      new InviteDeclinedEvent(invite.id, invite.email, invite.tenant.id),
    );
  }

  async getInviteByToken(token: string): Promise<Invite> {
    const invite = await this.inviteRepository.findByToken(token);

    if (!invite) {
      throw new NotFoundException("Invitation not found");
    }

    return invite;
  }

  async getTenantInvites(tenantId: string, query?: any): Promise<IPaginatedData<Partial<Invite>>> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;

    const queryBuilder = this.inviteRepository
      .createQueryBuilder("invite")
      .leftJoin("invite.invitedBy", "invitedBy")
      .leftJoin("invitedBy.user", "inviterUser")
      .select([
        "invite.id",
        "invite.email",
        "invite.role",
        "invite.status",
        "invite.expiresAt",
        "invite.createdAt",
        "invite.acceptedAt",
        "invite.declinedAt",
        "invitedBy.id",
        "inviterUser.id",
        "inviterUser.email",
        "inviterUser.name",
      ])
      .where("invite.tenantId = :tenantId", { tenantId })
      .orderBy("invite.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    const [invites, total] = await queryBuilder.getManyAndCount();

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

    return getPaginationSummary(sanitizedInvites, total, { page, limit }, "invites");
  }

  async cancelInvite(tenantId: string, inviteId: string): Promise<void> {
    const invite = await this.inviteRepository.findById(inviteId, false, {
      tenant: { id: tenantId },
    });

    if (!invite) {
      throw new NotFoundException("Invitation not found");
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException("Can only cancel pending invitations");
    }

    await this.inviteRepository.update(inviteId, {
      status: InviteStatus.CANCELLED,
    });
  }

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

  private generateInviteToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }
}
