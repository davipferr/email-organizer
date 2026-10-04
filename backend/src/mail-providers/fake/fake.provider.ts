import { Injectable } from '@nestjs/common';
import { MailProviderType } from '../../generated/prisma/enums.js';
import { chunk } from '../../common/async.js';
import { ProviderNotFoundError, ProviderRequestError } from '../provider-errors.js';
import type {
  ListMessagesQuery,
  MailLabel,
  MailMessageFull,
  MailMessageSummary,
  MailProvider,
  MessagePage,
  MessageSelector,
  OAuthTokens,
  ProviderAuth,
  ProviderProfile,
  SyncChanges,
  SyncProgress,
} from '../mail-provider.js';
import { createFakeMailbox, labelWithCounts, searchMessages, toFull, toSummary, type FakeMailbox } from './fake-mailbox.js';

// Dev-only provider with an in-memory mailbox, so the app can be tested without
// Google. Registered only when DEV_LOGIN=true (see MailProviderRegistry); accounts are
// created by the dev login. The mailbox key is the account's access token.
// A backend restart resets every mailbox to the fixtures.
@Injectable()
export class FakeMailProvider implements MailProvider {
  readonly type = MailProviderType.FAKE;
  readonly capabilities = { multiLabel: true, folders: false };
  private readonly mailboxes = new Map<string, FakeMailbox>();

  // Tokens for a fake account; the dev login stores them like real ones.
  static tokensFor(email: string): OAuthTokens {
    const token = `fake:${email}`;
    return { accessToken: token, refreshToken: token, expiresAt: new Date('2100-01-01') };
  }

  reset(email: string): void {
    this.mailboxes.set(FakeMailProvider.tokensFor(email).accessToken, createFakeMailbox());
  }

  private mailbox(auth: ProviderAuth): FakeMailbox {
    let mailbox = this.mailboxes.get(auth.accessToken);
    if (!mailbox) {
      mailbox = createFakeMailbox();
      this.mailboxes.set(auth.accessToken, mailbox);
    }
    return mailbox;
  }

  private touch(mailbox: FakeMailbox, ids: string[], change: (labels: Set<string>) => void) {
    const messages = ids.map((id) => mailbox.messages.get(id));
    if (messages.some((m) => !m)) throw new ProviderNotFoundError();
    mailbox.version++;
    for (const m of messages) {
      change(m!.labelIds);
      m!.version = mailbox.version;
    }
  }

  // ---------- OAuth (not used: fake accounts log in through /api/auth/dev-login) ----------

  getAuthUrl(): string {
    throw new Error('The fake provider has no OAuth flow; use /api/auth/dev-login');
  }

  exchangeCode(): Promise<{ tokens: OAuthTokens; profile: ProviderProfile }> {
    throw new Error('The fake provider has no OAuth flow; use /api/auth/dev-login');
  }

  // ---------- Messages ----------

  async listMessages(auth: ProviderAuth, query: ListMessagesQuery): Promise<MessagePage> {
    const all = searchMessages(this.mailbox(auth), query.q, query.labelId);
    const offset = Number(query.pageToken ?? 0);
    const limit = query.limit ?? 50;
    const page = all.slice(offset, offset + limit);
    return {
      messages: page.map(toSummary),
      nextPageToken: offset + limit < all.length ? String(offset + limit) : undefined,
      totalEstimate: all.length,
    };
  }

  async getMessage(auth: ProviderAuth, id: string): Promise<MailMessageFull> {
    const message = this.mailbox(auth).messages.get(id);
    if (!message) throw new ProviderNotFoundError();
    return toFull(message);
  }

  async resolveSelector(auth: ProviderAuth, selector: MessageSelector): Promise<string[]> {
    if ('ids' in selector) return selector.ids;
    const q = 'from' in selector ? `from:${selector.from}` : selector.q;
    return searchMessages(this.mailbox(auth), q).map((m) => m.id);
  }

  async modifyLabels(auth: ProviderAuth, ids: string[], add: string[], remove: string[]): Promise<void> {
    const mailbox = this.mailbox(auth);
    if ([...add, ...remove].some((id) => !mailbox.labels.has(id))) throw new ProviderRequestError(400, 'Invalid label');
    this.touch(mailbox, ids, (labels) => {
      for (const id of remove) labels.delete(id);
      for (const id of add) labels.add(id);
    });
  }

  async trash(auth: ProviderAuth, ids: string[]): Promise<void> {
    this.touch(this.mailbox(auth), ids, (labels) => labels.add('TRASH'));
  }

  async untrash(auth: ProviderAuth, ids: string[]): Promise<void> {
    this.touch(this.mailbox(auth), ids, (labels) => labels.delete('TRASH'));
  }

  // ---------- Labels ----------

  async listLabels(auth: ProviderAuth, options: { withCounts?: boolean } = {}): Promise<MailLabel[]> {
    const mailbox = this.mailbox(auth);
    const labels = [...mailbox.labels.values()];
    return options.withCounts
      ? labels.map((l) => (l.type === 'USER' ? labelWithCounts(mailbox, l) : { ...l }))
      : labels.map((l) => ({ ...l }));
  }

  async createLabel(auth: ProviderAuth, input: { name: string; colorBg?: string; colorText?: string }): Promise<MailLabel> {
    const mailbox = this.mailbox(auth);
    this.assertUniqueName(mailbox, input.name);
    const label: MailLabel = {
      providerLabelId: `Label_${mailbox.nextLabelNumber++}`,
      name: input.name,
      type: 'USER',
      ...colors(input),
    };
    mailbox.labels.set(label.providerLabelId, label);
    return { ...label };
  }

  async updateLabel(
    auth: ProviderAuth,
    id: string,
    input: { name?: string; colorBg?: string; colorText?: string },
  ): Promise<MailLabel> {
    const mailbox = this.mailbox(auth);
    const label = mailbox.labels.get(id);
    if (!label) throw new ProviderNotFoundError();
    if (label.type === 'SYSTEM') throw new ProviderRequestError(400, 'Invalid label');
    if (input.name && input.name !== label.name) this.assertUniqueName(mailbox, input.name);
    Object.assign(label, input.name ? { name: input.name } : {}, colors(input));
    return { ...label };
  }

  async deleteLabel(auth: ProviderAuth, id: string): Promise<void> {
    const mailbox = this.mailbox(auth);
    const label = mailbox.labels.get(id);
    if (!label) throw new ProviderNotFoundError();
    if (label.type === 'SYSTEM') throw new ProviderRequestError(400, 'Invalid label');
    mailbox.labels.delete(id);
    const tagged = [...mailbox.messages.values()].filter((m) => m.labelIds.has(id)).map((m) => m.id);
    if (tagged.length) this.touch(mailbox, tagged, (labels) => labels.delete(id));
  }

  private assertUniqueName(mailbox: FakeMailbox, name: string) {
    const taken = [...mailbox.labels.values()].some((l) => l.name.toLowerCase() === name.toLowerCase());
    if (taken) throw new ProviderRequestError(409, 'A tag with this name already exists');
  }

  // ---------- Sync ----------

  async fullSync(
    auth: ProviderAuth,
    onBatch: (batch: MailMessageSummary[], progress: SyncProgress) => Promise<void>,
  ): Promise<{ cursor: string }> {
    const mailbox = this.mailbox(auth);
    const cursor = `${mailbox.generation}:${mailbox.version}`;
    const all = [...mailbox.messages.values()].map(toSummary);
    let processed = 0;
    for (const batch of chunk(all, 50)) {
      processed += batch.length;
      await onBatch(batch, { total: all.length, processed });
    }
    return { cursor };
  }

  async incrementalSync(auth: ProviderAuth, cursor: string): Promise<SyncChanges | null> {
    const mailbox = this.mailbox(auth);
    const [generation, version] = cursor.split(':');
    const since = Number(version);
    // A cursor from before a reset or backend restart (the mailbox was rebuilt): full sync needed.
    if (generation !== mailbox.generation || !Number.isInteger(since)) return null;
    const upserted = [...mailbox.messages.values()].filter((m) => m.version > since).map(toSummary);
    return { upserted, deletedIds: [], newCursor: `${mailbox.generation}:${mailbox.version}` };
  }
}

function colors(input: { colorBg?: string; colorText?: string }) {
  return input.colorBg && input.colorText ? { colorBg: input.colorBg, colorText: input.colorText } : {};
}
