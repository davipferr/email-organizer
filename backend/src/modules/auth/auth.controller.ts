import { Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SessionGuard } from '../../common/auth/session.guard.js';
import { CurrentUserId } from '../../common/auth/current-user.decorator.js';
import { AuthService } from './auth.service.js';
import { DevLoginService } from './dev-login.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly devLoginService: DevLoginService,
  ) {}

  // Redirects to Google's consent screen.
  @Get('google')
  google(@Res() res: Response) {
    return this.auth.redirectToGoogle(res);
  }

  // Google redirects back here with ?code=...; creates user, account and session.
  @Get('google/callback')
  googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.auth.handleGoogleCallback(req, res);
  }

  // Local development only (DEV_LOGIN=true, 404 otherwise): logs in with the fake mailbox.
  // Open /api/auth/dev-login?reset=1 to start from a clean, known state; add &slowSync=1
  // to make a full sync last ~8 s (to test the Stop button).
  @Get('dev-login')
  devLogin(
    @Query('reset') reset: string | undefined,
    @Query('slowSync') slowSync: string | undefined,
    @Res() res: Response,
  ) {
    const flag = (value: string | undefined) => value === '1' || value === 'true';
    return this.devLoginService.login(res, flag(reset), flag(slowSync));
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUserId() userId: string) {
    return this.auth.me(userId);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req, res);
  }
}
