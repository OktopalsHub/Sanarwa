import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentProjectId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    // Project context would be handled separately
    return null;
  },
);