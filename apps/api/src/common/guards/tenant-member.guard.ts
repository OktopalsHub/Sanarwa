import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OrganizationService } from "../../modules/organization/organization.service";
import { TenantMemberService } from "../../modules/tenant-member/tenant-member.service";
import { TenantMemberRole } from "../enums";
import { AuthenticatedRequest } from "../interfaces/request-context.interface";

@Injectable()
export class TenantMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly organizationService?: OrganizationService,
    @Optional() private readonly tenantMemberService?: TenantMemberService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user?.id && !request?.auth?.principalId) {
      throw new UnauthorizedException("User not authenticated");
    }

    const userId = request.user?.id || request.auth?.principalId;

    const rawTenantId =
      request.params?.tenantId ||
      request.headers["x-tenant-id"] ||
      (request.auth as { activeOrganizationId?: string | null } | undefined)?.activeOrganizationId;
    const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;
    if (!tenantId) {
      throw new ForbiddenException("Tenant ID not found in route parameters");
    }

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(tenantId)) {
      throw new ForbiddenException("Invalid tenant ID");
    }

    try {
      if (this.organizationService) {
        const membership = await this.organizationService.getMembership(tenantId, userId);
        if (membership) {
          request.member = {
            id: membership.id,
            userId: membership.userId,
            tenantId: membership.organizationId,
            role: toRole(membership.role),
          };
          return true;
        }
      }

      if (!this.tenantMemberService) {
        return true;
      }

      const tenantMember = await this.tenantMemberService.getMemberByUserId(tenantId, userId);

      if (!tenantMember) {
        throw new ForbiddenException("User is not a member of this tenant");
      }

      request.member = {
        id: tenantMember.id,
        userId: tenantMember.user.id,
        tenantId: tenantMember.tenant.id,
        role: tenantMember.role,
      };

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new ForbiddenException("Failed to verify tenant membership");
    }
  }
}

function toRole(role: string): TenantMemberRole {
  if (role === "owner") return TenantMemberRole.OWNER;
  if (role === "admin") return TenantMemberRole.ADMIN;
  if (role === "viewer") return TenantMemberRole.VIEWER;
  return TenantMemberRole.MEMBER;
}
