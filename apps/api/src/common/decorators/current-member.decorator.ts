import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedRequest, MemberContext } from "../interfaces/request-context.interface";

/**
 * Decorator to extract the current tenant member from the request
 * Usage: @CurrentMember() member: MemberContext
 */
export const CurrentMember = createParamDecorator(
  (data: keyof MemberContext | undefined, ctx: ExecutionContext): MemberContext | any => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const member = request.member;

    if (!member) {
      throw new Error("Member context not found. Make sure TenantMemberGuard is applied.");
    }

    return data ? member[data] : member;
  },
);

/**
 * Decorator to extract just the member ID
 * Usage: @CurrentMemberId() memberId: string
 */
export const CurrentMemberId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const member = request.member;

    if (!member) {
      throw new Error("Member context not found. Make sure TenantMemberGuard is applied.");
    }

    return member.id;
  },
);

/**
 * Decorator to extract the tenant ID from member context
 * Usage: @CurrentTenantId() tenantId: string
 */
export const CurrentTenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const member = request.member;

    if (!member) {
      throw new Error("Member context not found. Make sure TenantMemberGuard is applied.");
    }

    return member.tenantId;
  },
);
