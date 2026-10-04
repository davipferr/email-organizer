import type { gmail_v1 } from 'googleapis';
import type { MailAddress, MailLabel, MailMessageFull, MailMessageSummary } from '../mail-provider.js';

type Headers = Record<string, string | undefined>;

export function headerMap(headers: gmail_v1.Schema$MessagePartHeader[] = []): Headers {
  const map: Headers = {};
  for (const h of headers) {
    if (h.name) map[h.name.toLowerCase()] = h.value ?? undefined;
  }
  return map;
}

// "Nubank <todomundo@nubank.com.br>" | "\"Doe, John\" <john@x.com>" | "john@x.com"
export function parseAddress(raw = ''): MailAddress {
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim();
    return { email: match[2].trim().toLowerCase(), name: name || undefined };
  }
  return { email: raw.trim().toLowerCase() };
}

export function parseAddressList(raw = ''): MailAddress[] {
  return (raw.match(/(?:"[^"]*"|[^,])+/g) ?? []).map(parseAddress).filter((a) => a.email);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// Gmail snippets come HTML-escaped (e.g. "Don&#39;t").
export function decodeEntities(text = ''): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(n) ? whole : String.fromCodePoint(n);
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

export function toSummary(message: gmail_v1.Schema$Message): MailMessageSummary {
  const headers = headerMap(message.payload?.headers);
  const labelIds = message.labelIds ?? [];
  return {
    providerMessageId: message.id!,
    threadId: message.threadId!,
    from: parseAddress(headers['from']),
    subject: headers['subject'] || undefined,
    snippet: decodeEntities(message.snippet ?? '') || undefined,
    date: new Date(Number(message.internalDate ?? 0)),
    sizeBytes: message.sizeEstimate ?? 0,
    labelIds,
    isUnread: labelIds.includes('UNREAD'),
    listUnsubscribe: headers['list-unsubscribe'] || undefined,
  };
}

function decodeBody(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8');
}

function findPart(part: gmail_v1.Schema$MessagePart | undefined, mimeType: string): string | undefined {
  if (!part) return undefined;
  if (part.mimeType === mimeType && part.body?.data && !part.filename) return decodeBody(part.body.data);
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function toFull(message: gmail_v1.Schema$Message): MailMessageFull {
  const headers = headerMap(message.payload?.headers);
  return {
    ...toSummary(message),
    to: parseAddressList(headers['to']),
    cc: parseAddressList(headers['cc']),
    html: findPart(message.payload, 'text/html'),
    text: findPart(message.payload, 'text/plain'),
  };
}

export function toLabel(label: gmail_v1.Schema$Label): MailLabel {
  return {
    providerLabelId: label.id!,
    name: label.name!,
    type: label.type === 'system' ? 'SYSTEM' : 'USER',
    colorBg: label.color?.backgroundColor ?? undefined,
    colorText: label.color?.textColor ?? undefined,
    messagesTotal: label.messagesTotal ?? undefined,
    messagesUnread: label.messagesUnread ?? undefined,
  };
}
