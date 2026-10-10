import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { currentUserId } from './tenant-context';

/** Injects the authenticated Supabase user id into a controller parameter. */
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request & { userId?: string }>();
    return req.userId ?? currentUserId();
  },
);
