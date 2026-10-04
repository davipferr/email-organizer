import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';

// Browsers share cookies across ports, so each parallel dev instance (scripts/dev.mjs slot,
// which sets DB_SUFFIX) needs its own cookie name or logging into one logs out the others.
export const SESSION_COOKIE = `sid${process.env['DB_SUFFIX'] ?? ''}`;

export interface AuthedRequest extends Request {
  userId: string;
}

// Protects every route that needs a logged-in user.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const sid: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (!sid) throw new UnauthorizedException();

    const session = await this.prisma.session.findUnique({ where: { id: sid } });
    if (!session || session.expiresAt < new Date()) throw new UnauthorizedException();

    req.userId = session.userId;
    return true;
  }
}
