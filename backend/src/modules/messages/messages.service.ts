import { Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service.js';
import { MessageStoreService } from '../sync/message-store.service.js';
import type { LabelsChangeInput, ListMessagesInput, MoveInput, TrashInput } from './messages.schemas.js';

// Live from the provider. Actions on selected emails run immediately and are also
// applied to the synced rows, so the Senders view stays correct without a new sync.
@Injectable()
export class MessagesService {
  constructor(
    private readonly accounts: AccountsService,
    private readonly store: MessageStoreService,
  ) {}

  async list(userId: string, accountId: string, query: ListMessagesInput) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    return provider.listMessages(auth, query);
  }

  async get(userId: string, accountId: string, messageId: string) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    return provider.getMessage(auth, messageId);
  }

  async trash(userId: string, accountId: string, { selector: { ids } }: TrashInput) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    await provider.trash(auth, ids);
    await this.store.applyLabelChange(accountId, ids, ['TRASH'], []);
    return { affected: ids.length };
  }

  async untrash(userId: string, accountId: string, { selector: { ids } }: TrashInput) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    await provider.untrash(auth, ids);
    await this.store.applyLabelChange(accountId, ids, [], ['TRASH']);
    return { affected: ids.length };
  }

  async changeLabels(userId: string, accountId: string, { selector: { ids }, add, remove }: LabelsChangeInput) {
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    await provider.modifyLabels(auth, ids, add, remove);
    await this.store.applyLabelChange(accountId, ids, add, remove);
    return { affected: ids.length };
  }

  async move(userId: string, accountId: string, { selector: { ids }, to, from }: MoveInput) {
    const remove = from === to ? [] : [from];
    const { provider, auth } = await this.accounts.getProviderContext(userId, accountId);
    await provider.modifyLabels(auth, ids, [to], remove);
    await this.store.applyLabelChange(accountId, ids, [to], remove);
    return { affected: ids.length };
  }
}
