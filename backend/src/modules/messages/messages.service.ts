import { Injectable, NotImplementedException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service.js';
import type { MessageSelector } from '../../mail-providers/mail-provider.js';
import type { LabelsChangeInput, ListMessagesInput, MoveInput, TrashInput } from './messages.schemas.js';

// Live from the provider. Selections of ids run immediately; whole-sender / search
// selections will run as pg-boss BULK_ACTION jobs with progress (Senders step).
@Injectable()
export class MessagesService {
  constructor(private readonly accounts: AccountsService) {}

  async list(userId: string, accountId: string, query: ListMessagesInput) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    return provider.listMessages(auth, query);
  }

  async get(userId: string, accountId: string, messageId: string) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    return provider.getMessage(auth, messageId);
  }

  async trash(userId: string, accountId: string, input: TrashInput) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    const ids = this.selectedIds(input.selector);
    await provider.trash(auth, ids);
    return { affected: ids.length };
  }

  async untrash(userId: string, accountId: string, input: TrashInput) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    const ids = this.selectedIds(input.selector);
    await provider.untrash(auth, ids);
    return { affected: ids.length };
  }

  async changeLabels(userId: string, accountId: string, input: LabelsChangeInput) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    const ids = this.selectedIds(input.selector);
    await provider.modifyLabels(auth, ids, input.add, input.remove);
    return { affected: ids.length };
  }

  async move(userId: string, accountId: string, input: MoveInput) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    const ids = this.selectedIds(input.selector);
    await provider.modifyLabels(auth, ids, [input.to], input.from === input.to ? [] : [input.from]);
    return { affected: ids.length };
  }

  // TODO (Senders step): queue { from } / { q } selectors as BULK_ACTION jobs,
  // and update the synced Message rows after each action.
  private selectedIds(selector: MessageSelector): string[] {
    if ('ids' in selector) return selector.ids;
    throw new NotImplementedException('Bulk actions by sender or search are not available yet');
  }
}
