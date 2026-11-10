import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedRequest, MemberContext } from "../interfaces/request-context.interface";

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
