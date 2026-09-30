import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Tenant } from "../entities/tenant.entity";

export const CurrentTenant = createParamDecorator(
  (data: keyof Tenant | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const tenant = request.tenant;

    return data ? tenant?.[data] : tenant;
  },
);

export const CurrentTenantId = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.tenantId;
});
