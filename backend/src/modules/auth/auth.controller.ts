import { Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SessionGuard } from '../../common/auth/session.guard.js';
import { CurrentUserId } from '../../common/auth/current-user.decorator.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Redirects to Google's consent screen.
  @Get('google')
  google(@Res() res: Response) {
    return this.auth.redirectToGoogle(res);
  }

  // Google redirects back here with ?code=...; creates user, account and session.
  @Get('google/callback')
  googleCallback(@Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res() res: Response) {
    return this.auth.handleGoogleCallback(code, state, req, res);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUserId() userId: string) {
    return this.auth.me(userId);
  }

  @Post('logout')
  @UseGuards(SessionGuard)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req, res);
  }
}
