import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentApiKey = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  return null;
});
