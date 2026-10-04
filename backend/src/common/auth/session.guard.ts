import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';

export const SESSION_COOKIE = 'sid';

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
