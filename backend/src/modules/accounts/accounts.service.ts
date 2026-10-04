import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TokenCipherService } from '../../common/crypto/token-cipher.service.js';
import { MailProviderRegistry } from '../../mail-providers/mail-provider.registry.js';
import type { MailProvider, ProviderAuth } from '../../mail-providers/mail-provider.js';
import type { MailAccount } from '../../generated/prisma/client.js';

// Shared helper used by the other modules: loads a MailAccount owned by the user,
// returns its provider implementation and decrypted credentials.
@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: TokenCipherService,
    private readonly providers: MailProviderRegistry,
  ) {}

  async getOwnedAccount(userId: string, accountId: string): Promise<MailAccount> {
    const account = await this.prisma.mailAccount.findUnique({ where: { id: accountId } });
    if (!account || account.userId !== userId) throw new ForbiddenException();
    return account;
  }

  async getProviderContext(
    userId: string,
    accountId: string,
  ): Promise<{ account: MailAccount; provider: MailProvider; auth: ProviderAuth }> {
    const account = await this.getOwnedAccount(userId, accountId);
    return { account, provider: this.providers.get(account.provider), auth: this.authFor(account) };
  }

  authFor(account: MailAccount): ProviderAuth {
    return {
      accessToken: this.cipher.decrypt(account.accessToken),
      refreshToken: this.cipher.decrypt(account.refreshToken),
      expiresAt: account.tokenExpiresAt,
      onTokensRefreshed: async (tokens) => {
        await this.prisma.mailAccount.update({
          where: { id: account.id },
          data: {
            accessToken: this.cipher.encrypt(tokens.accessToken),
            refreshToken: this.cipher.encrypt(tokens.refreshToken),
            tokenExpiresAt: tokens.expiresAt,
          },
        });
      },
      onAuthFailed: async () => {
        await this.prisma.mailAccount.update({ where: { id: account.id }, data: { needsReconnect: true } });
      },
    };
  }
}
