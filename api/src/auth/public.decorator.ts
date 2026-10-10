import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as public so the global AuthGuard skips it (e.g. /api/health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
