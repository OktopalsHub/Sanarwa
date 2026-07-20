import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from '../../modules/auth/decorators/public.decorator';
import { TenantMemberService } from '../../modules/tenant-member/tenant-member.service';
import {
  AuthenticatedRequest,
  MemberContext,
} from '../interfaces/request-context.interface';

/**
 * Resolves tenant context from route param or X-Tenant-ID header.
 * Must run after AuthGuard so request.user is populated.
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly tenantMemberService: TenantMemberService,
    private readonly reflector: Reflector,
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
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = request.user?.id || request.auth?.principalId;
    const tenantId =
      request.params?.tenantId ||
      (request.headers['x-tenant-id'] as string | undefined);

    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant ID required via route param or X-Tenant-ID header',
      );
    }

    const tenantMember = await this.tenantMemberService.getMemberByUserId(
      tenantId,
      userId,
    );

    if (!tenantMember) {
      throw new ForbiddenException('User is not a member of this tenant');
    }

    const memberContext: MemberContext = {
      id: tenantMember.id,
      userId: tenantMember.user.id,
      tenantId: tenantMember.tenant.id,
      role: tenantMember.role,
    };

    request.member = memberContext;

    return true;
  }
}
