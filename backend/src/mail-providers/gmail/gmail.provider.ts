import { Injectable, Logger } from '@nestjs/common';
import { google, type gmail_v1 } from 'googleapis';
import { MailProviderType } from '../../generated/prisma/enums.js';
import { AppConfig } from '../../config/config.module.js';
import { chunk, mapLimit, sleep } from '../../common/async.js';
import { MissingScopesError, ProviderAuthError, ProviderNotFoundError } from '../provider-errors.js';
import { toFull, toLabel, toSummary } from './gmail-parsers.js';
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

const GMAIL_MODIFY = 'https://www.googleapis.com/auth/gmail.modify';
const GMAIL_LABELS = 'https://www.googleapis.com/auth/gmail.labels';

// Only these scopes — never https://mail.google.com/ (permanent delete).
export const GMAIL_SCOPES = ['openid', 'email', 'profile', GMAIL_MODIFY, GMAIL_LABELS];

const METADATA_HEADERS = ['From', 'Subject', 'Date', 'List-Unsubscribe'];
// Gmail allows ~250 quota units/user/second; messages.get costs 5.
const CONCURRENCY = 8;
const SYNC_BATCH = 100;

type Gmail = gmail_v1.Gmail;

@Injectable()
export class GmailProvider implements MailProvider {
  readonly type = MailProviderType.GMAIL;
  readonly capabilities = { multiLabel: true, folders: false };
  private readonly logger = new Logger(GmailProvider.name);

  constructor(private readonly config: AppConfig) {}

  private get redirectUri() {
    return `${this.config.get('APP_URL', { infer: true })}/api/auth/google/callback`;
  }

  private oauthClient() {
    return new google.auth.OAuth2(
      this.config.get('GOOGLE_CLIENT_ID', { infer: true }),
      this.config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
      this.redirectUri,
    );
  }

  private gmail(auth: ProviderAuth): Gmail {
    const client = this.oauthClient();
    client.setCredentials({
      access_token: auth.accessToken,
      refresh_token: auth.refreshToken,
      expiry_date: auth.expiresAt.getTime(),
    });
    client.on('tokens', (tokens) => {
      if (!tokens.access_token) return;
      void auth.onTokensRefreshed?.({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? auth.refreshToken,
        expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
      });
    });
    return google.gmail({ version: 'v1', auth: client });
  }

  // Retries rate limits / transient errors with exponential backoff and maps
  // auth and not-found errors to provider-agnostic errors.
  private async call<T>(auth: ProviderAuth, fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const status = errorStatus(err);
        if (status === 401 || errorCode(err) === 'invalid_grant') {
          await auth.onAuthFailed?.();
          throw new ProviderAuthError();
        }
        if (status === 404) throw new ProviderNotFoundError();
        if (isRetryable(err) && attempt < 5) {
          await sleep(2 ** attempt * 500 + Math.random() * 250);
          continue;
        }
        throw err;
      }
    }
  }

  // ---------- OAuth ----------

  getAuthUrl(state: string): string {
    return this.oauthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // always returns a refresh token
      scope: GMAIL_SCOPES,
      state,
    });
  }

  async exchangeCode(code: string): Promise<{ tokens: OAuthTokens; profile: ProviderProfile }> {
    const client = this.oauthClient();
    const { tokens } = await client.getToken(code);

    // Google lets users untick permissions on the consent screen.
    const granted = (tokens.scope ?? '').split(' ');
    if (!granted.includes(GMAIL_MODIFY) || !granted.includes(GMAIL_LABELS)) {
      throw new MissingScopesError();
    }
    if (!tokens.access_token || !tokens.refresh_token || !tokens.id_token) {
      throw new Error('Google did not return the expected tokens');
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.config.get('GOOGLE_CLIENT_ID', { infer: true }),
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new Error('Google did not return an email address');

    return {
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
      },
      profile: { email: payload.email.toLowerCase(), name: payload.name, avatarUrl: payload.picture },
    };
  }

  // ---------- Messages ----------

  private async getSummaries(auth: ProviderAuth, gmail: Gmail, ids: string[]): Promise<MailMessageSummary[]> {
    const results = await mapLimit(ids, CONCURRENCY, async (id) => {
      try {
        const res = await this.call(auth, () =>
          gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: METADATA_HEADERS }),
        );
        return toSummary(res.data);
      } catch (err) {
        if (err instanceof ProviderNotFoundError) return null; // deleted in the meantime
        throw err;
      }
    });
    return results.filter((m): m is MailMessageSummary => m !== null);
  }

  async listMessages(auth: ProviderAuth, query: ListMessagesQuery): Promise<MessagePage> {
    const gmail = this.gmail(auth);
    const res = await this.call(auth, () =>
      gmail.users.messages.list({
        userId: 'me',
        q: query.q,
        labelIds: query.labelId ? [query.labelId] : undefined,
        includeSpamTrash: query.labelId === 'TRASH' || query.labelId === 'SPAM',
        pageToken: query.pageToken,
        maxResults: query.limit ?? 50,
      }),
    );
    const ids = (res.data.messages ?? []).map((m) => m.id!);
    return {
      messages: await this.getSummaries(auth, gmail, ids),
      nextPageToken: res.data.nextPageToken ?? undefined,
      totalEstimate: res.data.resultSizeEstimate ?? undefined,
    };
  }

  async getMessage(auth: ProviderAuth, id: string): Promise<MailMessageFull> {
    const gmail = this.gmail(auth);
    const res = await this.call(auth, () => gmail.users.messages.get({ userId: 'me', id, format: 'full' }));
    return toFull(res.data);
  }

  private async listAllIds(auth: ProviderAuth, gmail: Gmail, q?: string): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.call(auth, () =>
        gmail.users.messages.list({ userId: 'me', q, pageToken, maxResults: 500 }),
      );
      ids.push(...(res.data.messages ?? []).map((m) => m.id!));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return ids;
  }

  async resolveSelector(auth: ProviderAuth, selector: MessageSelector): Promise<string[]> {
    if ('ids' in selector) return selector.ids;
    const q = 'from' in selector ? `from:${selector.from}` : selector.q;
    return this.listAllIds(auth, this.gmail(auth), q);
  }

  async modifyLabels(auth: ProviderAuth, ids: string[], add: string[], remove: string[]): Promise<void> {
    const gmail = this.gmail(auth);
    for (const part of chunk(ids, 1000)) {
      await this.call(auth, () =>
        gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: { ids: part, addLabelIds: add, removeLabelIds: remove },
        }),
      );
    }
  }

  async trash(auth: ProviderAuth, ids: string[]): Promise<void> {
    const gmail = this.gmail(auth);
    await mapLimit(ids, CONCURRENCY, (id) => this.call(auth, () => gmail.users.messages.trash({ userId: 'me', id })));
  }

  async untrash(auth: ProviderAuth, ids: string[]): Promise<void> {
    const gmail = this.gmail(auth);
    await mapLimit(ids, CONCURRENCY, (id) => this.call(auth, () => gmail.users.messages.untrash({ userId: 'me', id })));
  }

  // ---------- Labels ----------

  async listLabels(auth: ProviderAuth): Promise<MailLabel[]> {
    const gmail = this.gmail(auth);
    const res = await this.call(auth, () => gmail.users.labels.list({ userId: 'me' }));
    return (res.data.labels ?? []).map(toLabel);
  }

  async createLabel(
    auth: ProviderAuth,
    input: { name: string; colorBg?: string; colorText?: string },
  ): Promise<MailLabel> {
    const gmail = this.gmail(auth);
    const res = await this.call(auth, () =>
      gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: input.name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
          color: labelColor(input),
        },
      }),
    );
    return toLabel(res.data);
  }

  async updateLabel(
    auth: ProviderAuth,
    id: string,
    input: { name?: string; colorBg?: string; colorText?: string },
  ): Promise<MailLabel> {
    const gmail = this.gmail(auth);
    const res = await this.call(auth, () =>
      gmail.users.labels.patch({ userId: 'me', id, requestBody: { name: input.name, color: labelColor(input) } }),
    );
    return toLabel(res.data);
  }

  async deleteLabel(auth: ProviderAuth, id: string): Promise<void> {
    const gmail = this.gmail(auth);
    await this.call(auth, () => gmail.users.labels.delete({ userId: 'me', id }));
  }

  // ---------- Sync ----------

  async fullSync(
    auth: ProviderAuth,
    onBatch: (batch: MailMessageSummary[], progress: SyncProgress) => Promise<void>,
  ): Promise<{ cursor: string }> {
    const gmail = this.gmail(auth);
    // Take the cursor BEFORE listing, so changes made during the sync are picked up next time.
    const profile = await this.call(auth, () => gmail.users.getProfile({ userId: 'me' }));
    const cursor = profile.data.historyId!;

    const ids = await this.listAllIds(auth, gmail);
    let processed = 0;
    for (const part of chunk(ids, SYNC_BATCH)) {
      const batch = await this.getSummaries(auth, gmail, part);
      processed += part.length;
      await onBatch(batch, { total: ids.length, processed });
    }
    return { cursor };
  }

  async incrementalSync(auth: ProviderAuth, cursor: string): Promise<SyncChanges | null> {
    const gmail = this.gmail(auth);
    const changed = new Set<string>();
    const deleted = new Set<string>();
    let newCursor = cursor;
    let pageToken: string | undefined;

    try {
      do {
        const res = await this.call(auth, () =>
          gmail.users.history.list({ userId: 'me', startHistoryId: cursor, pageToken, maxResults: 500 }),
        );
        for (const h of res.data.history ?? []) {
          for (const m of h.messagesAdded ?? []) changed.add(m.message!.id!);
          for (const m of h.labelsAdded ?? []) changed.add(m.message!.id!);
          for (const m of h.labelsRemoved ?? []) changed.add(m.message!.id!);
          for (const m of h.messagesDeleted ?? []) deleted.add(m.message!.id!);
        }
        newCursor = res.data.historyId ?? newCursor;
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
    } catch (err) {
      // The cursor is too old (Gmail keeps about a week of history): full sync needed.
      if (err instanceof ProviderNotFoundError) return null;
      throw err;
    }

    for (const id of deleted) changed.delete(id);
    const upserted = await this.getSummaries(auth, gmail, [...changed]);
    const found = new Set(upserted.map((m) => m.providerMessageId));
    for (const id of changed) if (!found.has(id)) deleted.add(id);

    this.logger.debug(`Incremental sync: ${upserted.length} changed, ${deleted.size} deleted`);
    return { upserted, deletedIds: [...deleted], newCursor };
  }
}

function labelColor(input: { colorBg?: string; colorText?: string }) {
  // Gmail only accepts colors from its own palette, and both values together.
  return input.colorBg && input.colorText
    ? { backgroundColor: input.colorBg, textColor: input.colorText }
    : undefined;
}

function errorStatus(err: unknown): number | undefined {
  const e = err as { status?: number; code?: number | string; response?: { status?: number } };
  return e.response?.status ?? e.status ?? (typeof e.code === 'number' ? e.code : undefined);
}

function errorCode(err: unknown): string | undefined {
  const e = err as { response?: { data?: { error?: unknown } } };
  return typeof e.response?.data?.error === 'string' ? e.response.data.error : undefined;
}

function isRetryable(err: unknown): boolean {
  const status = errorStatus(err);
  if (status === 429 || status === 500 || status === 502 || status === 503) return true;
  if (status === 403) {
    const e = err as { errors?: { reason?: string }[] };
    return (e.errors ?? []).some((x) => x.reason === 'rateLimitExceeded' || x.reason === 'userRateLimitExceeded');
  }
  return false;
}
