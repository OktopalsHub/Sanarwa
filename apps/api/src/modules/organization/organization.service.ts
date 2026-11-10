import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TenantMemberRole, TenantMemberStatus } from "../../common/enums";
import { TenantMember } from "../tenant-member/entities/tenant-member.entity";
import { Member } from "./entities/member.entity";
import { Organization } from "./entities/organization.entity";

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(TenantMember)
    private readonly tenantMemberRepository: Repository<TenantMember>,
  ) {}

  async getMembership(organizationId: string, userId: string) {
    return this.memberRepository.findOne({
      where: { organizationId, userId },
      relations: { organization: true, user: true },
    });
  }

  async listForUser(userId: string) {
    return this.memberRepository.find({
      where: { userId },
      relations: { organization: true },
    });
  }

  async syncTenantMember(member: Member) {
    const role = toTenantMemberRole(member.role);
    const existing = await this.tenantMemberRepository.findOne({
      where: { tenantId: member.organizationId, userId: member.userId },
    });
    if (existing) {
      await this.tenantMemberRepository.update(existing.id, {
        role,
        status: TenantMemberStatus.ACTIVE,
        name: member.name ?? existing.name,
        avatar: member.avatar ?? existing.avatar,
      });
      return;
    }
    await this.tenantMemberRepository.save(
      this.tenantMemberRepository.create({
        tenantId: member.organizationId,
        userId: member.userId,
        role,
        status: TenantMemberStatus.ACTIVE,
        name: member.name ?? null,
        avatar: member.avatar ?? null,
      }),
    );
  }

  async deactivateTenantMember(organizationId: string, userId: string) {
    await this.tenantMemberRepository.update(
      { tenantId: organizationId, userId },
      { status: TenantMemberStatus.INACTIVE },
    );
  }
}

function toTenantMemberRole(role: string): TenantMemberRole {
  if (role === "owner") return TenantMemberRole.OWNER;
  if (role === "admin") return TenantMemberRole.ADMIN;
  if (role === "viewer") return TenantMemberRole.VIEWER;
  return TenantMemberRole.MEMBER;
}
