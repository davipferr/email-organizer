import { describe, expect, it } from 'vitest';
import { decodeEntities, parseAddress, parseAddressList, toFull, toLabel, toSummary } from './gmail-parsers.js';

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64url');

describe('parseAddress', () => {
  it('splits name and email, lowercasing the email', () => {
    expect(parseAddress('Nubank <TodoMundo@Nubank.com.br>')).toEqual({ email: 'todomundo@nubank.com.br', name: 'Nubank' });
  });

  it('handles quoted names with commas', () => {
    expect(parseAddress('"Doe, John" <john@x.com>')).toEqual({ email: 'john@x.com', name: 'Doe, John' });
  });

  it('handles a bare address', () => {
    expect(parseAddress(' john@x.com ')).toEqual({ email: 'john@x.com' });
  });

  it('drops an empty name', () => {
    expect(parseAddress('<john@x.com>')).toEqual({ email: 'john@x.com', name: undefined });
  });
});

describe('parseAddressList', () => {
  it('does not split on commas inside quotes', () => {
    expect(parseAddressList('"Doe, John" <john@x.com>, jane@y.com')).toEqual([
      { email: 'john@x.com', name: 'Doe, John' },
      { email: 'jane@y.com' },
    ]);
  });

  it('returns an empty list for an empty header', () => {
    expect(parseAddressList('')).toEqual([]);
  });
});

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('Don&#39;t &amp; &lt;b&gt; &#x41;')).toBe("Don't & <b> A");
  });

  it('leaves unknown entities untouched', () => {
    expect(decodeEntities('&bogus;')).toBe('&bogus;');
  });
});

describe('toSummary', () => {
  it('maps headers, unread state and date', () => {
    const summary = toSummary({
      id: 'm1',
      threadId: 't1',
      internalDate: '1700000000000',
      snippet: 'It&#39;s here',
      sizeEstimate: 2048,
      labelIds: ['INBOX', 'UNREAD'],
      payload: {
        headers: [
          { name: 'From', value: 'Shop <news@shop.com>' },
          { name: 'Subject', value: 'Sale' },
          { name: 'List-Unsubscribe', value: '<mailto:u@shop.com>' },
        ],
      },
    });
    expect(summary).toEqual({
      providerMessageId: 'm1',
      threadId: 't1',
      from: { email: 'news@shop.com', name: 'Shop' },
      subject: 'Sale',
      snippet: "It's here",
      date: new Date(1700000000000),
      sizeBytes: 2048,
      labelIds: ['INBOX', 'UNREAD'],
      isUnread: true,
      listUnsubscribe: '<mailto:u@shop.com>',
    });
  });
});

describe('toFull', () => {
  it('finds html and text parts in nested multipart bodies, skipping attachments', () => {
    const full = toFull({
      id: 'm1',
      threadId: 't1',
      payload: {
        headers: [{ name: 'To', value: 'a@x.com, b@x.com' }],
        mimeType: 'multipart/mixed',
        parts: [
          {
            mimeType: 'multipart/alternative',
            parts: [
              { mimeType: 'text/plain', body: { data: b64('plain body') } },
              { mimeType: 'text/html', body: { data: b64('<p>html body</p>') } },
            ],
          },
          { mimeType: 'text/plain', filename: 'notes.txt', body: { data: b64('attachment') } },
        ],
      },
    });
    expect(full.text).toBe('plain body');
    expect(full.html).toBe('<p>html body</p>');
    expect(full.to).toEqual([{ email: 'a@x.com' }, { email: 'b@x.com' }]);
  });
});

describe('toLabel', () => {
  it('maps system and user labels', () => {
    expect(toLabel({ id: 'INBOX', name: 'INBOX', type: 'system' }).type).toBe('SYSTEM');
    expect(toLabel({ id: 'Label_1', name: 'Bills', type: 'user', color: { backgroundColor: '#fff' } })).toMatchObject({
      type: 'USER',
      colorBg: '#fff',
    });
  });
});
