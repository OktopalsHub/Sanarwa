import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentProjectId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | undefined => {
    return ctx.switchToHttp().getRequest().apiKey?.projectId;
  },
);
