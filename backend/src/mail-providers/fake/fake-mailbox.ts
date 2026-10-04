import { randomUUID } from 'node:crypto';
import type { MailAddress, MailLabel, MailMessageFull, MailMessageSummary } from '../mail-provider.js';

// In-memory mailbox used by FakeMailProvider so agents (and you) can exercise every
// feature without a Google account. Generated from a fixed seed: same emails, same
// order and same labels on every reset; only the dates move along with "now".

export interface FakeMessage {
  id: string;
  threadId: string;
  from: MailAddress;
  to: MailAddress[];
  cc: MailAddress[];
  subject: string;
  snippet: string;
  html?: string;
  text?: string;
  date: Date;
  sizeBytes: number;
  labelIds: Set<string>;
  listUnsubscribe?: string;
  version: number; // mailbox version of the last change, for incremental sync
}

export interface FakeMailbox {
  messages: Map<string, FakeMessage>;
  labels: Map<string, MailLabel>;
  generation: string; // changes on every rebuild, so old sync cursors are rejected
  version: number;
  nextLabelNumber: number;
}

export const FAKE_OWNER: MailAddress = { email: 'dev@fake.local', name: 'Dev User' };

const SYSTEM_LABELS = [
  'INBOX',
  'SENT',
  'STARRED',
  'IMPORTANT',
  'UNREAD',
  'TRASH',
  'SPAM',
  'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES',
  'CATEGORY_SOCIAL',
];

const USER_LABELS: MailLabel[] = [
  { providerLabelId: 'Label_1', name: 'Finance', type: 'USER', colorBg: '#16a766', colorText: '#ffffff' },
  { providerLabelId: 'Label_2', name: 'Finance/Bills', type: 'USER', colorBg: '#fb4c2f', colorText: '#ffffff' },
  { providerLabelId: 'Label_3', name: 'Travel', type: 'USER', colorBg: '#4a86e8', colorText: '#ffffff' },
  { providerLabelId: 'Label_4', name: 'Newsletters', type: 'USER', colorBg: '#a479e2', colorText: '#ffffff' },
  { providerLabelId: 'Label_5', name: 'Receipts', type: 'USER' },
];

interface SenderSpec {
  from: MailAddress;
  count: number;
  subjects: string[];
  labels: string[];
  body: 'html' | 'text' | 'both';
  unreadRate: number;
  archivedRate?: number; // share without INBOX
  starredRate?: number;
  unsubscribe?: boolean | 'https'; // 'https' adds a web link before the mailto, as most senders do
  attachmentKb?: number;
  folder?: 'SENT' | 'SPAM' | 'TRASH';
}

function unsubscribeHeader(spec: SenderSpec): string | undefined {
  if (!spec.unsubscribe) return undefined;
  const domain = spec.from.email.split('@')[1];
  const mailto = `<mailto:unsubscribe@${domain}>`;
  return spec.unsubscribe === 'https' ? `<https://${domain}/unsubscribe?u=dev>, ${mailto}` : mailto;
}

const SENDERS: SenderSpec[] = [
  {
    from: { email: 'noreply@medium.com', name: 'Medium Daily Digest' },
    count: 40,
    subjects: ['Your daily digest #{n}', '{n} stories picked for you', 'Top stories in Programming'],
    labels: ['CATEGORY_UPDATES', 'Label_4'],
    body: 'html',
    unreadRate: 0.7,
    archivedRate: 0.2,
    unsubscribe: true,
  },
  {
    from: { email: 'noreply@github.com', name: 'GitHub' },
    count: 35,
    subjects: ['[email-organizer] Issue #{n} opened', '[email-organizer] PR #{n} merged', 'Your security alert digest'],
    labels: ['CATEGORY_UPDATES'],
    body: 'text',
    unreadRate: 0.4,
    archivedRate: 0.3,
  },
  {
    from: { email: 'no-reply@amazon.com', name: 'Amazon' },
    count: 22,
    subjects: ['Your order #{n} has shipped', 'Deals picked for you', 'Rate your recent purchase'],
    labels: ['CATEGORY_PROMOTIONS'],
    body: 'html',
    unreadRate: 0.5,
    unsubscribe: true,
  },
  {
    from: { email: 'orders@amazon.com', name: 'Amazon Orders' },
    count: 10,
    subjects: ['Order confirmation #{n}', 'Invoice for order #{n}'],
    labels: ['Label_5'],
    body: 'both',
    unreadRate: 0.1,
    attachmentKb: 180,
  },
  {
    from: { email: 'todomundo@nubank.com.br', name: 'Nubank' },
    count: 25,
    subjects: ['Sua fatura fechou', 'Pagamento recebido', 'Compra aprovada de R$ {n},90'],
    labels: ['Label_1', 'Label_2'],
    body: 'html',
    unreadRate: 0.3,
    starredRate: 0.2,
  },
  {
    from: { email: 'notifications@linkedin.com', name: 'LinkedIn' },
    count: 20,
    subjects: ['{n} people viewed your profile', 'New jobs for you', 'You appeared in {n} searches'],
    labels: ['CATEGORY_SOCIAL'],
    body: 'html',
    unreadRate: 0.8,
    unsubscribe: true,
  },
  {
    from: { email: 'deals@shop.example', name: 'Shop Deals' },
    count: 15,
    subjects: ['🔥 {n}% off everything', 'Last chance: free shipping', 'Your cart misses you'],
    labels: ['CATEGORY_PROMOTIONS'],
    body: 'html',
    unreadRate: 0.9,
    unsubscribe: 'https',
  },
  {
    from: { email: 'ana.souza@gmail.com', name: 'Ana Souza' },
    count: 8,
    subjects: ['Trip plans', 'Re: Trip plans', 'Photos from the weekend', 'Dinner on Friday?'],
    labels: ['IMPORTANT'],
    body: 'text',
    unreadRate: 0.25,
    starredRate: 0.5,
  },
  {
    from: { email: 'john@company.example', name: 'Doe, John' },
    count: 5,
    subjects: ['Q{n} planning', 'Re: contract review', 'Meeting notes'],
    labels: ['IMPORTANT'],
    body: 'both',
    unreadRate: 0.2,
    attachmentKb: 2400,
  },
  {
    from: { email: 'booking@skyair.example', name: 'SkyAir' },
    count: 6,
    subjects: ['Your boarding pass', 'Booking confirmed: GRU → LIS', 'Check-in is open'],
    labels: ['Label_3'],
    body: 'html',
    unreadRate: 0.3,
    starredRate: 0.3,
  },
  {
    from: FAKE_OWNER,
    count: 5,
    subjects: ['Re: Trip plans', 'Re: Dinner on Friday?', 'Contract signed'],
    labels: [],
    body: 'text',
    unreadRate: 0,
    folder: 'SENT',
  },
  {
    from: { email: 'winner@lottery.example', name: 'Lottery Winner Dept' },
    count: 4,
    subjects: ['You WON $1,000,000', 'Claim your prize now'],
    labels: [],
    body: 'html',
    unreadRate: 1,
    folder: 'SPAM',
  },
  {
    from: { email: 'deals@shop.example', name: 'Shop Deals' },
    count: 6,
    subjects: ['Flash sale ends tonight', 'New arrivals'],
    labels: ['CATEGORY_PROMOTIONS'],
    body: 'html',
    unreadRate: 0.5,
    folder: 'TRASH',
  },
];

// Small deterministic PRNG (mulberry32).
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bodyFor(spec: SenderSpec, subject: string, n: number) {
  const text = `Hi Dev,\n\n${subject}.\n\nThis is fake email #${n} from ${spec.from.name ?? spec.from.email}, generated for local testing.\n\nBest,\n${spec.from.name ?? ''}`;
  // Remote image + a script tag: the frontend must sanitize (DOMPurify) before rendering.
  const html =
    `<div style="font-family:sans-serif"><h2>${subject}</h2>` +
    `<p>This is fake email #${n} from <b>${spec.from.name ?? spec.from.email}</b>, generated for local testing.</p>` +
    `<p><a href="https://example.com/${n}">Open in browser</a></p>` +
    `<img src="https://picsum.photos/seed/${n}/400/120" alt="">` +
    `<script>window.__fakeEmailScriptRan = true</script></div>`;
  return {
    text: spec.body === 'html' ? undefined : text,
    html: spec.body === 'text' ? undefined : html,
    snippet: `${subject}. This is fake email #${n} from ${spec.from.name ?? spec.from.email}`.slice(0, 140),
  };
}

export function createFakeMailbox(now = new Date()): FakeMailbox {
  const rand = random(42);
  const labels = new Map<string, MailLabel>();
  for (const id of SYSTEM_LABELS) labels.set(id, { providerLabelId: id, name: id, type: 'SYSTEM' });
  for (const label of USER_LABELS) labels.set(label.providerLabelId, { ...label });

  // One entry per email, then shuffled so senders are interleaved in the list.
  const entries = SENDERS.flatMap((spec) => Array.from({ length: spec.count }, (_, i) => ({ spec, i })));
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  const messages = new Map<string, FakeMessage>();
  entries.forEach(({ spec, i }, index) => {
    const n = index + 1;
    const id = `fake-${String(n).padStart(4, '0')}`;
    const subject = spec.subjects[i % spec.subjects.length].replace('{n}', String((n * 7) % 97 + 3));
    const { text, html, snippet } = bodyFor(spec, subject, n);

    const labelIds = new Set(spec.labels);
    if (spec.folder) labelIds.add(spec.folder);
    if (!spec.folder && rand() >= (spec.archivedRate ?? 0)) labelIds.add('INBOX');
    if (rand() < spec.unreadRate) labelIds.add('UNREAD');
    if (rand() < (spec.starredRate ?? 0)) labelIds.add('STARRED');

    // Newest first: a few today, most this year, the oldest about a year ago.
    const hoursAgo = 0.6 * index ** 1.8 + rand();
    const sent = spec.folder === 'SENT';
    const to = sent ? [{ email: 'ana.souza@gmail.com', name: 'Ana Souza' }] : [FAKE_OWNER];

    messages.set(id, {
      id,
      threadId: subject.replace(/^Re: /, '').toLowerCase().includes('trip plans') ? 'thread-trip-plans' : `thread-${id}`,
      from: spec.from,
      to,
      cc: spec.from.email === 'john@company.example' ? [{ email: 'team@company.example' }] : [],
      subject,
      snippet,
      text,
      html,
      date: new Date(now.getTime() - hoursAgo * 3600_000),
      sizeBytes: (text?.length ?? 0) + (html?.length ?? 0) + (spec.attachmentKb ?? 0) * 1024 + Math.floor(rand() * 4000),
      labelIds,
      listUnsubscribe: unsubscribeHeader(spec),
      version: 0,
    });
  });

  return { messages, labels, generation: randomUUID(), version: 0, nextLabelNumber: USER_LABELS.length + 1 };
}

// ---------- Search (a useful subset of Gmail's syntax) ----------

// Gmail's label: operator uses lowercase names with "/" and spaces as "-".
const labelSlug = (name: string) => name.toLowerCase().replace(/[/\s]+/g, '-');

function tokenize(q: string): string[] {
  return (q.match(/(?:[^\s"]+:)?"[^"]*"|\S+/g) ?? []).map((t) => t.replace(/"/g, ''));
}

// Supports from:, to:, subject:, label:, is:unread|read|starred, in:inbox|trash|spam|sent|anywhere
// and free words (all must match). Like Gmail, Trash and Spam are left out unless asked for.
export function matchesQuery(mailbox: FakeMailbox, message: FakeMessage, q = '', labelId?: string): boolean {
  let includeTrashSpam = labelId === 'TRASH' || labelId === 'SPAM';
  if (labelId && !message.labelIds.has(labelId)) return false;

  for (const token of tokenize(q.toLowerCase())) {
    const [op, ...rest] = token.split(':');
    const value = rest.join(':');
    const address = (a: MailAddress) => `${a.name ?? ''} ${a.email}`.toLowerCase();

    if (value && op === 'from') {
      if (!address(message.from).includes(value)) return false;
    } else if (value && op === 'to') {
      if (!message.to.some((a) => address(a).includes(value))) return false;
    } else if (value && op === 'subject') {
      if (!message.subject.toLowerCase().includes(value)) return false;
    } else if (value && op === 'label') {
      const label = [...mailbox.labels.values()].find(
        (l) => l.providerLabelId.toLowerCase() === value || labelSlug(l.name) === labelSlug(value),
      );
      if (!label || !message.labelIds.has(label.providerLabelId)) return false;
    } else if (value && op === 'is') {
      if (value === 'unread' && !message.labelIds.has('UNREAD')) return false;
      if (value === 'read' && message.labelIds.has('UNREAD')) return false;
      if (value === 'starred' && !message.labelIds.has('STARRED')) return false;
    } else if (value && op === 'in') {
      if (value === 'anywhere') includeTrashSpam = true;
      else {
        const id = value.toUpperCase();
        if (id === 'TRASH' || id === 'SPAM') includeTrashSpam = true;
        if (!message.labelIds.has(id)) return false;
      }
    } else {
      const haystack = `${address(message.from)} ${message.subject} ${message.snippet} ${message.text ?? ''}`.toLowerCase();
      if (!haystack.includes(token)) return false;
    }
  }

  return includeTrashSpam || (!message.labelIds.has('TRASH') && !message.labelIds.has('SPAM'));
}

// Newest first, like Gmail.
export function searchMessages(mailbox: FakeMailbox, q?: string, labelId?: string): FakeMessage[] {
  return [...mailbox.messages.values()]
    .filter((m) => matchesQuery(mailbox, m, q, labelId))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

// ---------- Mapping to the provider contract ----------

export function toSummary(m: FakeMessage): MailMessageSummary {
  return {
    providerMessageId: m.id,
    threadId: m.threadId,
    from: m.from,
    subject: m.subject,
    snippet: m.snippet,
    date: m.date,
    sizeBytes: m.sizeBytes,
    labelIds: [...m.labelIds],
    isUnread: m.labelIds.has('UNREAD'),
    listUnsubscribe: m.listUnsubscribe,
  };
}

export function toFull(m: FakeMessage): MailMessageFull {
  return { ...toSummary(m), to: m.to, cc: m.cc, html: m.html, text: m.text };
}

export function labelWithCounts(mailbox: FakeMailbox, label: MailLabel): MailLabel {
  const inLabel = [...mailbox.messages.values()].filter((m) => m.labelIds.has(label.providerLabelId));
  return {
    ...label,
    messagesTotal: inLabel.length,
    messagesUnread: inLabel.filter((m) => m.labelIds.has('UNREAD')).length,
  };
}
