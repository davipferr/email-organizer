import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { MailProvider, ProviderAuth } from '../../mail-providers/mail-provider.js';
import { ProviderNotFoundError } from '../../mail-providers/provider-errors.js';

// Read-only tools Claude can call to answer a question. Nothing here changes the mailbox.

const SEARCH_LIMIT = 25;
// Longer bodies (newsletters, long threads) are cut; the reply says so, so Claude knows.
const MAX_BODY_CHARS = 30_000;

export const ASK_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'search_emails',
    description:
      "Search the user's synced emails (Trash and Spam excluded), newest first. Returns id, sender, " +
      'subject, snippet, date, tags and unread for up to 25 emails, plus the total number of matches. ' +
      'All filters are optional and combined with AND; text filters are case-insensitive substrings. ' +
      'Use it for counts too: totalMatches is exact.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Part of the sender address or name, e.g. "nubank" or "ana.souza@gmail.com"' },
        subject: { type: 'string', description: 'Text that must appear in the subject' },
        text: { type: 'string', description: 'Text that must appear in the subject, snippet or sender' },
        after: { type: 'string', description: "Only emails on or after this date (YYYY-MM-DD, the user's time zone)" },
        before: { type: 'string', description: "Only emails before this date (YYYY-MM-DD, the user's time zone)" },
        tag: { type: 'string', description: 'A tag/label name, e.g. "Finance", or a system label: INBOX, STARRED, SENT, IMPORTANT' },
        unread: { type: 'boolean', description: 'true = only unread, false = only read' },
        limit: { type: 'integer', description: 'How many emails to return, 1-25 (default 10)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'read_email',
    description:
      'Fetch the full text of one email by the id returned from search_emails. Use it when the answer is ' +
      'likely inside the email body (dates, amounts, codes, details), not just its subject or snippet.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The email id from search_emails' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
];

const searchInput = z.object({
  from: z.string().optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
  after: z.iso.date().optional(),
  before: z.iso.date().optional(),
  tag: z.string().optional(),
  unread: z.boolean().optional(),
  limit: z.number().int().min(1).max(SEARCH_LIMIT).default(10),
});
const readInput = z.object({ id: z.string().min(1) });

export interface EmailRef {
  id: string;
  from: string;
  subject: string | null;
  date: string;
}

export interface ToolContext {
  prisma: PrismaService;
  accountId: string;
  provider: MailProvider;
  auth: ProviderAuth;
  timeZone: string; // dates in and out of the tools are in the user's zone
  // Every email a tool returned, so the answer can link the ones it cites.
  seen: Map<string, EmailRef>;
}

const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });

// "2026-10-01 14:05" in the user's zone, so Claude quotes the dates the user sees in the app.
const localDateTime = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone, dateStyle: 'short', timeStyle: 'short' }).format(date);

// Midnight of a YYYY-MM-DD day in `timeZone`, as an instant.
function startOfLocalDay(day: string, timeZone: string): Date {
  const utcMidnight = new Date(`${day}T00:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(utcMidnight)
      .map((p) => [p.type, Number(p.value)]),
  );
  // How far the zone's wall clock is from UTC at that moment.
  const offset = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - utcMidnight.getTime();
  return new Date(utcMidnight.getTime() - offset);
}

async function searchEmails(ctx: ToolContext, raw: unknown) {
  const input = searchInput.parse(raw);
  const and: Prisma.MessageWhereInput[] = [
    { accountId: ctx.accountId },
    { labels: { none: { label: { providerLabelId: { in: ['TRASH', 'SPAM'] } } } } },
  ];
  if (input.from) and.push({ OR: [{ fromEmail: contains(input.from) }, { fromName: contains(input.from) }] });
  if (input.subject) and.push({ subject: contains(input.subject) });
  if (input.text) {
    and.push({
      OR: [
        { subject: contains(input.text) },
        { snippet: contains(input.text) },
        { fromEmail: contains(input.text) },
        { fromName: contains(input.text) },
      ],
    });
  }
  if (input.after) and.push({ date: { gte: startOfLocalDay(input.after, ctx.timeZone) } });
  if (input.before) and.push({ date: { lt: startOfLocalDay(input.before, ctx.timeZone) } });
  if (input.tag) {
    const tag = input.tag;
    and.push({
      labels: { some: { label: { OR: [{ name: { equals: tag, mode: 'insensitive' } }, { providerLabelId: tag.toUpperCase() }] } } },
    });
  }
  if (input.unread !== undefined) and.push({ isUnread: input.unread });

  const where: Prisma.MessageWhereInput = { AND: and };
  const [totalMatches, messages] = await Promise.all([
    ctx.prisma.message.count({ where }),
    ctx.prisma.message.findMany({
      where,
      orderBy: { date: 'desc' },
      take: input.limit,
      include: { labels: { include: { label: true } } },
    }),
  ]);

  const emails = messages.map((m) => {
    const ref: EmailRef = {
      id: m.providerMessageId,
      from: m.fromName ? `${m.fromName} <${m.fromEmail}>` : m.fromEmail,
      subject: m.subject,
      date: m.date.toISOString(),
    };
    ctx.seen.set(ref.id, ref);
    return {
      ...ref,
      date: localDateTime(m.date, ctx.timeZone),
      snippet: m.snippet,
      tags: m.labels.map((l) => l.label.name),
      unread: m.isUnread,
    };
  });
  return { totalMatches, returned: emails.length, emails };
}

// Readable text from an email's HTML: drops scripts/styles/tags and collapses whitespace.
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

async function readEmail(ctx: ToolContext, raw: unknown) {
  const { id } = readInput.parse(raw);
  // Only emails of this account that are in the synced copy can be opened.
  const known = await ctx.prisma.message.findUnique({
    where: { accountId_providerMessageId: { accountId: ctx.accountId, providerMessageId: id } },
  });
  if (!known) return { error: `No email with id ${id}. Use an id returned by search_emails.` };

  try {
    const email = await ctx.provider.getMessage(ctx.auth, id);
    const ref: EmailRef = {
      id,
      from: email.from.name ? `${email.from.name} <${email.from.email}>` : email.from.email,
      subject: email.subject ?? null,
      date: email.date.toISOString(),
    };
    ctx.seen.set(id, ref);
    const body = email.text?.trim() || (email.html ? htmlToText(email.html) : '');
    const truncated = body.length > MAX_BODY_CHARS;
    return {
      ...ref,
      date: localDateTime(email.date, ctx.timeZone),
      to: email.to.map((a) => a.email),
      cc: email.cc.map((a) => a.email),
      body: truncated ? body.slice(0, MAX_BODY_CHARS) : body,
      ...(truncated ? { note: `Body cut to the first ${MAX_BODY_CHARS} characters.` } : {}),
    };
  } catch (err) {
    if (err instanceof ProviderNotFoundError) return { error: 'That email no longer exists in the mailbox.' };
    throw err;
  }
}

// Runs one tool call. Bad input comes back as an error result Claude can correct.
export async function runTool(ctx: ToolContext, name: string, input: unknown): Promise<{ content: string; isError: boolean }> {
  try {
    const result = name === 'search_emails' ? await searchEmails(ctx, input) : name === 'read_email' ? await readEmail(ctx, input) : null;
    if (!result) return { content: `Unknown tool ${name}`, isError: true };
    return { content: JSON.stringify(result), isError: 'error' in result };
  } catch (err) {
    if (err instanceof z.ZodError) return { content: `Invalid input: ${z.prettifyError(err)}`, isError: true };
    throw err;
  }
}
