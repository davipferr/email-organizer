import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfig } from '../../config/config.module.js';
import { TokenCipherService } from '../../common/crypto/token-cipher.service.js';
import { SESSION_COOKIE } from '../../common/auth/session.guard.js';
import { MailProviderRegistry } from '../../mail-providers/mail-provider.registry.js';
import { FakeMailProvider } from '../../mail-providers/fake/fake.provider.js';
import { FAKE_OWNER } from '../../mail-providers/fake/fake-mailbox.js';
import { MissingScopesError } from '../../mail-providers/provider-errors.js';
import { MailProviderType } from '../../generated/prisma/enums.js';

const STATE_COOKIE = 'oauth_state';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly cipher: TokenCipherService,
    private readonly providers: MailProviderRegistry,
    private readonly fake: FakeMailProvider,
  ) {}

  private get gmail() {
    return this.providers.get(MailProviderType.GMAIL);
  }

  private cookieOptions(maxAgeMs: number): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: '/',
      maxAge: maxAgeMs,
    };
  }

  private appUrl(path: string) {
    return `${this.config.get('APP_URL', { infer: true })}${path}`;
  }

  redirectToGoogle(res: Response): void {
    // Random state, checked on the callback, protects against login CSRF.
    const state = randomBytes(16).toString('base64url');
    res.cookie(STATE_COOKIE, state, this.cookieOptions(10 * 60_000));
    res.redirect(this.gmail.getAuthUrl(state));
  }

  async handleGoogleCallback(req: Request, res: Response): Promise<void> {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    const expectedState: string | undefined = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: '/' });

    if (error) return res.redirect(this.appUrl('/login?error=denied'));
    if (!code || !state || state !== expectedState) return res.redirect(this.appUrl('/login?error=state'));

    try {
      const { tokens, profile } = await this.gmail.exchangeCode(code);

      const user = await this.prisma.user.upsert({
        where: { email: profile.email },
        create: { email: profile.email, name: profile.name, avatarUrl: profile.avatarUrl },
        update: { name: profile.name, avatarUrl: profile.avatarUrl, lastLoginAt: new Date() },
      });

      const encrypted = {
        accessToken: this.cipher.encrypt(tokens.accessToken),
        refreshToken: this.cipher.encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        needsReconnect: false,
      };
      await this.prisma.mailAccount.upsert({
        where: { provider_emailAddress: { provider: MailProviderType.GMAIL, emailAddress: profile.email } },
        create: { userId: user.id, provider: MailProviderType.GMAIL, emailAddress: profile.email, ...encrypted },
        update: encrypted,
      });

      await this.startSession(user.id, res);
      res.redirect(this.appUrl('/inbox'));
    } catch (err) {
      if (err instanceof MissingScopesError) return res.redirect(this.appUrl('/login?error=scopes'));
      this.logger.error('Google login failed', err instanceof Error ? err.stack : err);
      res.redirect(this.appUrl('/login?error=failed'));
    }
  }

  private async startSession(userId: string, res: Response): Promise<void> {
    const ttlMs = this.config.get('SESSION_TTL_DAYS', { infer: true }) * 24 * 3600_000;
    const session = await this.prisma.session.create({
      data: {
        id: randomBytes(32).toString('base64url'),
        userId,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    res.cookie(SESSION_COOKIE, session.id, this.cookieOptions(ttlMs));
  }

  // Local development only (DEV_LOGIN=true): logs in as a user whose only mailbox is the
  // fake in-memory one. With reset, the mailbox goes back to the fixtures and all synced
  // data for it is deleted, as if the user had just signed up.
  async devLogin(res: Response, reset: boolean): Promise<void> {
    if (!this.config.get('DEV_LOGIN', { infer: true })) throw new NotFoundException();
    const { email, name } = FAKE_OWNER;
    const where = { provider_emailAddress: { provider: MailProviderType.FAKE, emailAddress: email } };

    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, name },
      update: { lastLoginAt: new Date() },
    });
    if (reset) {
      await this.prisma.mailAccount.deleteMany({ where: where.provider_emailAddress });
      this.fake.reset(email);
    }
    const tokens = FakeMailProvider.tokensFor(email);
    const encrypted = {
      accessToken: this.cipher.encrypt(tokens.accessToken),
      refreshToken: this.cipher.encrypt(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
    };
    await this.prisma.mailAccount.upsert({
      where,
      create: { userId: user.id, provider: MailProviderType.FAKE, emailAddress: email, ...encrypted },
      update: encrypted,
    });

    await this.startSession(user.id, res);
    res.redirect(this.appUrl('/inbox'));
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { accounts: { orderBy: { createdAt: 'asc' } } },
    });
    return {
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
      accounts: user.accounts.map((a) => ({
        id: a.id,
        provider: a.provider,
        emailAddress: a.emailAddress,
        needsReconnect: a.needsReconnect,
        lastSyncedAt: a.lastSyncedAt,
      })),
    };
  }

  async logout(req: Request, res: Response): Promise<void> {
    const sid: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (sid) await this.prisma.session.deleteMany({ where: { id: sid } });
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
