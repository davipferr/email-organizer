import { Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfig } from '../../config/config.module.js';
import { TokenCipherService } from '../../common/crypto/token-cipher.service.js';
// The one place outside mail-providers/ allowed to use the fake provider directly
// (see the override in .oxlintrc.json): it creates and resets the fake account.
import { FakeMailProvider } from '../../mail-providers/fake/fake.provider.js';
import { FAKE_OWNER } from '../../mail-providers/fake/fake-mailbox.js';
import { MailProviderType } from '../../generated/prisma/enums.js';
import { AuthService } from './auth.service.js';

// Local development only (DEV_LOGIN=true): logs in as a user whose only mailbox is the
// fake in-memory one. With reset, the mailbox goes back to the fixtures and all synced
// data for it is deleted, as if the user had just signed up.
@Injectable()
export class DevLoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly cipher: TokenCipherService,
    private readonly fake: FakeMailProvider,
    private readonly auth: AuthService,
  ) {}

  async login(res: Response, reset: boolean): Promise<void> {
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

    await this.auth.startSession(user.id, res);
    // Relative, so each parallel dev instance (its own port) lands on itself.
    res.redirect('/inbox');
  }
}
