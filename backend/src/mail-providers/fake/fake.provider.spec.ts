import { beforeEach, describe, expect, it } from 'vitest';
import { ProviderNotFoundError, ProviderRequestError } from '../provider-errors.js';
import type { MailMessageSummary, ProviderAuth } from '../mail-provider.js';
import { createFakeMailbox, searchMessages } from './fake-mailbox.js';
import { FakeMailProvider } from './fake.provider.js';

const auth: ProviderAuth = FakeMailProvider.tokensFor('dev@fake.local');

describe('createFakeMailbox', () => {
  it('is deterministic apart from dates', () => {
    const a = [...createFakeMailbox().messages.values()].map((m) => [m.id, m.subject, [...m.labelIds]]);
    const b = [...createFakeMailbox().messages.values()].map((m) => [m.id, m.subject, [...m.labelIds]]);
    expect(a).toEqual(b);
  });

  it('covers the states the UI needs', () => {
    const mailbox = createFakeMailbox();
    const all = [...mailbox.messages.values()];
    const count = (label: string) => all.filter((m) => m.labelIds.has(label)).length;
    expect(all.length).toBeGreaterThan(150);
    for (const label of ['INBOX', 'UNREAD', 'STARRED', 'SENT', 'TRASH', 'SPAM', 'Label_2']) {
      expect(count(label), label).toBeGreaterThan(0);
    }
    expect(all.some((m) => m.html && m.text)).toBe(true);
  });
});

describe('searchMessages', () => {
  const mailbox = createFakeMailbox();

  it('sorts newest first and leaves out Trash and Spam', () => {
    const results = searchMessages(mailbox);
    expect(results.every((m) => !m.labelIds.has('TRASH') && !m.labelIds.has('SPAM'))).toBe(true);
    const dates = results.map((m) => m.date.getTime());
    expect(dates).toEqual([...dates].sort((x, y) => y - x));
  });

  it('includes Trash when viewing it', () => {
    expect(searchMessages(mailbox, undefined, 'TRASH').length).toBe(6);
    expect(searchMessages(mailbox, 'in:trash').length).toBe(6);
  });

  it('supports from: by email, domain and name', () => {
    expect(searchMessages(mailbox, 'from:todomundo@nubank.com.br')).toHaveLength(25);
    expect(searchMessages(mailbox, 'from:amazon.com')).toHaveLength(32);
    expect(searchMessages(mailbox, 'from:"ana souza"').length).toBeGreaterThan(0);
  });

  it('supports label: by slug, is: and free text together', () => {
    const bills = searchMessages(mailbox, 'label:finance-bills');
    expect(bills).toHaveLength(25);
    const unreadBills = searchMessages(mailbox, 'label:finance-bills is:unread');
    expect(unreadBills.every((m) => m.labelIds.has('UNREAD'))).toBe(true);
    expect(searchMessages(mailbox, 'boarding pass').every((m) => m.from.email === 'booking@skyair.example')).toBe(true);
  });
});

describe('FakeMailProvider', () => {
  let provider: FakeMailProvider;
  beforeEach(() => {
    provider = new FakeMailProvider();
    provider.reset('dev@fake.local');
  });

  it('pages through the inbox', async () => {
    const first = await provider.listMessages(auth, { labelId: 'INBOX', limit: 20 });
    expect(first.messages).toHaveLength(20);
    const second = await provider.listMessages(auth, { labelId: 'INBOX', limit: 20, pageToken: first.nextPageToken });
    expect(second.messages[0].providerMessageId).not.toBe(first.messages[0].providerMessageId);
  });

  it('trashes and untrashes', async () => {
    const [m] = (await provider.listMessages(auth, { labelId: 'INBOX', limit: 1 })).messages;
    await provider.trash(auth, [m.providerMessageId]);
    expect((await provider.getMessage(auth, m.providerMessageId)).labelIds).toContain('TRASH');
    await provider.untrash(auth, [m.providerMessageId]);
    expect((await provider.getMessage(auth, m.providerMessageId)).labelIds).not.toContain('TRASH');
  });

  it('rejects unknown messages, unknown labels and duplicate tag names', async () => {
    await expect(provider.trash(auth, ['nope'])).rejects.toBeInstanceOf(ProviderNotFoundError);
    await expect(provider.modifyLabels(auth, ['fake-0001'], ['Label_99'], [])).rejects.toBeInstanceOf(ProviderRequestError);
    await expect(provider.createLabel(auth, { name: 'travel' })).rejects.toMatchObject({ status: 409 });
  });

  it('deleting a tag removes it from its emails', async () => {
    await provider.deleteLabel(auth, 'Label_3');
    expect(await provider.resolveSelector(auth, { q: 'label:Label_3' })).toEqual([]);
    expect((await provider.listLabels(auth)).some((l) => l.providerLabelId === 'Label_3')).toBe(false);
  });

  it('incremental sync returns only changed emails, and full sync after a reset', async () => {
    const synced: MailMessageSummary[] = [];
    const { cursor } = await provider.fullSync(auth, async (batch) => void synced.push(...batch));
    expect(synced.length).toBe(createFakeMailbox().messages.size);

    await provider.modifyLabels(auth, ['fake-0001', 'fake-0002'], ['STARRED'], []);
    const changes = await provider.incrementalSync(auth, cursor);
    expect(changes?.upserted.map((m) => m.providerMessageId).sort()).toEqual(['fake-0001', 'fake-0002']);

    provider.reset('dev@fake.local');
    expect(await provider.incrementalSync(auth, changes!.newCursor)).toBeNull();
  });
});
