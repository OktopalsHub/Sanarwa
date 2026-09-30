import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AsyncMemberContext } from "../interfaces/request-context.interface";
import { ContextService } from "../services/context.service";

export const CurrentContext = createParamDecorator(
  (data: keyof AsyncMemberContext | undefined, ctx: ExecutionContext): AsyncMemberContext | any => {
    const context = ContextService.getCurrentMemberContext();

    if (!context) {
      return null;
    }

    return data ? context[data] : context;
  },
);

export const CurrentMemberId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    return ContextService.getCurrentMemberId();
  },
);

export const CurrentTenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    return ContextService.getCurrentTenantId();
  },
);

export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    return ContextService.getCurrentUserId();
  },
);
