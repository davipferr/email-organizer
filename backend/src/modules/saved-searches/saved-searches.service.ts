import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import type { CreateSavedSearchInput, UpdateSavedSearchInput } from './saved-searches.controller.js';

@Injectable()
export class SavedSearchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
  ) {}

  async list(userId: string, accountId: string) {
    await this.accounts.getOwnedAccount(userId, accountId);
    return this.prisma.savedSearch.findMany({ where: { accountId }, orderBy: { createdAt: 'asc' } });
  }

  async create(userId: string, accountId: string, input: CreateSavedSearchInput) {
    await this.accounts.getOwnedAccount(userId, accountId);
    return this.prisma.savedSearch.create({ data: { accountId, ...input } });
  }

  async update(userId: string, accountId: string, id: string, input: UpdateSavedSearchInput) {
    await this.owned(userId, accountId, id);
    return this.prisma.savedSearch.update({ where: { id }, data: input });
  }

  async remove(userId: string, accountId: string, id: string) {
    await this.owned(userId, accountId, id);
    await this.prisma.savedSearch.delete({ where: { id } });
  }

  private async owned(userId: string, accountId: string, id: string) {
    await this.accounts.getOwnedAccount(userId, accountId);
    const search = await this.prisma.savedSearch.findFirst({ where: { id, accountId } });
    if (!search) throw new NotFoundException('Saved search not found');
    return search;
  }
}
