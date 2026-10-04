import { BadRequestException, Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service.js';
import type { MailProvider, ProviderAuth } from '../../mail-providers/mail-provider.js';
import type { CreateLabelInput, UpdateLabelInput } from './labels.controller.js';

@Injectable()
export class LabelsService {
  constructor(private readonly accounts: AccountsService) {}

  async list(userId: string, accountId: string) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    const labels = await provider.listLabels(auth);
    return labels.sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(userId: string, accountId: string, input: CreateLabelInput) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    return provider.createLabel(auth, input);
  }

  async update(userId: string, accountId: string, labelId: string, input: UpdateLabelInput) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    await this.assertUserLabel(provider, auth, labelId);
    return provider.updateLabel(auth, labelId, input);
  }

  // Deletes the tag only — emails are kept. Optionally deletes "Parent/..." children too.
  async remove(userId: string, accountId: string, labelId: string, withChildren: boolean) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    const labels = await provider.listLabels(auth);
    const label = labels.find((l) => l.providerLabelId === labelId);
    if (!label || label.type === 'SYSTEM') throw new BadRequestException('Built-in tags cannot be deleted');

    const toDelete = [label];
    if (withChildren) toDelete.push(...labels.filter((l) => l.name.startsWith(`${label.name}/`)));
    for (const l of toDelete) await provider.deleteLabel(auth, l.providerLabelId);
    return { deleted: toDelete.length };
  }

  private async assertUserLabel(provider: MailProvider, auth: ProviderAuth, labelId: string) {
    const label = (await provider.listLabels(auth)).find((l) => l.providerLabelId === labelId);
    if (!label || label.type === 'SYSTEM') throw new BadRequestException('Built-in tags cannot be changed');
  }
}
