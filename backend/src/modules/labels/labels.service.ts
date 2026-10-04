import { BadRequestException, Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service.js';
import type { MailLabel } from '../../mail-providers/mail-provider.js';
import type { CreateLabelInput, UpdateLabelInput } from './labels.controller.js';

@Injectable()
export class LabelsService {
  constructor(private readonly accounts: AccountsService) {}

  async list(userId: string, accountId: string, withCounts: boolean) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    const labels = await provider.listLabels(auth, { withCounts });
    return labels.sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(userId: string, accountId: string, input: CreateLabelInput) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    return provider.createLabel(auth, input);
  }

  // Renaming "Finance" also renames its children ("Finance/Nubank" → "Money/Nubank"),
  // because Gmail treats them as separate labels.
  async update(userId: string, accountId: string, labelId: string, input: UpdateLabelInput) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    const labels = await provider.listLabels(auth);
    const label = this.userLabel(labels, labelId, 'changed');

    const updated = await provider.updateLabel(auth, labelId, input);
    if (input.name && input.name !== label.name) {
      for (const child of labels.filter((l) => l.name.startsWith(`${label.name}/`))) {
        await provider.updateLabel(auth, child.providerLabelId, {
          name: input.name + child.name.slice(label.name.length),
        });
      }
    }
    return updated;
  }

  // Deletes the tag only — emails are kept. Optionally deletes "Parent/..." children too.
  async remove(userId: string, accountId: string, labelId: string, withChildren: boolean) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    const labels = await provider.listLabels(auth);
    const label = this.userLabel(labels, labelId, 'deleted');

    const toDelete = [label];
    if (withChildren) toDelete.push(...labels.filter((l) => l.name.startsWith(`${label.name}/`)));
    for (const l of toDelete) await provider.deleteLabel(auth, l.providerLabelId);
    return { deleted: toDelete.length };
  }

  private userLabel(labels: MailLabel[], labelId: string, action: string): MailLabel {
    const label = labels.find((l) => l.providerLabelId === labelId);
    if (!label || label.type === 'SYSTEM') throw new BadRequestException(`Built-in tags cannot be ${action}`);
    return label;
  }
}
