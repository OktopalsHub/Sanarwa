import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PUBLIC_KEY } from "../../modules/auth/decorators/public.decorator";
import { OrganizationService } from "../../modules/organization/organization.service";
import { TenantMemberService } from "../../modules/tenant-member/tenant-member.service";
import { TenantMemberRole } from "../enums";
import { AuthenticatedRequest, MemberContext } from "../interfaces/request-context.interface";

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly organizationService?: OrganizationService,
    @Optional() private readonly tenantMemberService?: TenantMemberService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

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
      throw new ForbiddenException("Tenant ID required via route param or X-Tenant-ID header");
    }

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

    if (this.tenantMemberService) {
      const member = await this.tenantMemberService.getMemberByUserId(tenantId, userId);
      if (member) {
        const memberContext: MemberContext = {
          id: member.id,
          userId: member.user.id,
          tenantId: member.tenant.id,
          role: member.role,
        };
        request.member = memberContext;
        return true;
      }
    }

    throw new ForbiddenException("User is not a member of this tenant");
  }
}

function toRole(role: string): TenantMemberRole {
  if (role === "owner") return TenantMemberRole.OWNER;
  if (role === "admin") return TenantMemberRole.ADMIN;
  if (role === "viewer") return TenantMemberRole.VIEWER;
  return TenantMemberRole.MEMBER;
}
