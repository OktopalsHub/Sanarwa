import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface MachineApiKey {
  id: string;
  keyPrefix: string;
  projectId: string;
  tenantId: string;
  permissions: string[];
  environment: string;
}

export const CurrentApiKey = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): MachineApiKey | undefined => {
    return ctx.switchToHttp().getRequest().apiKey;
  },
);
