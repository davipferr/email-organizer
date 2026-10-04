import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from './session.guard.js';

export const CurrentUserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().userId,
);
