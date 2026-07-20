import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantMemberService } from '../../modules/tenant-member/tenant-member.service';
import {
  AuthenticatedRequest,
  MemberContext,
} from '../interfaces/request-context.interface';

/**
 * This guard should be used on controllers that operate within a tenant context
 */
@Injectable()
export class TenantMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly tenantMemberService?: TenantMemberService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Check if user is authenticated (should be set by AuthGuard)
    if (!request.user?.id || !request?.auth?.principalId ) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Skip tenant membership check if TenantMemberService is not available
    if (!this.tenantMemberService) {
      return true;
    }

    // Extract tenant ID from route parameters
    const tenantId = request.params?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID not found in route parameters');
    }

    try {
      // Get the tenant member for this user and tenant
      const tenantMember = await this.tenantMemberService.getMemberByUserId(
        tenantId,
        request.user.id,
      );

      if (!tenantMember) {
        throw new ForbiddenException('User is not a member of this tenant');
      }

      // Populate the member context
      const memberContext: MemberContext = {
        id: tenantMember.id,
        userId: tenantMember.user.id,
        tenantId: tenantMember.tenant.id,
        role: tenantMember.role,
        // permissions: [], // TODO: Add permissions logic if needed
      };

      request.member = memberContext;

      return true;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new ForbiddenException('Failed to verify tenant membership');
    }
  }
}
