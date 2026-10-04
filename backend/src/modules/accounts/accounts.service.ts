import { ForbiddenException, Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { MailProvider, ProviderAuth } from '../../mail-providers/mail-provider.js';

// Shared helper used by the other modules: loads a MailAccount owned by the user,
// returns its provider implementation and decrypted credentials.
@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnedAccount(userId: string, accountId: string) {
    const account = await this.prisma.mailAccount.findUnique({ where: { id: accountId } });
    if (!account || account.userId !== userId) throw new ForbiddenException();
    return account;
  }

  getProviderContext(_userId: string, _accountId: string): Promise<{ provider: MailProvider; auth: ProviderAuth }> {
    throw new NotImplementedException();
  }
}
