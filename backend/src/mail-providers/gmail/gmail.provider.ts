import { Injectable, Logger } from '@nestjs/common';
import { google, type gmail_v1 } from 'googleapis';
import { MailProviderType } from '../../generated/prisma/enums.js';
import { AppConfig } from '../../config/config.module.js';
import { chunk, mapLimit, sleep, untilAborted } from '../../common/async.js';
import { RateLimiter } from '../../common/rate-limiter.js';
import { MissingScopesError, ProviderAuthError, ProviderNotFoundError, ProviderRequestError } from '../provider-errors.js';
import { errorCode, errorMessage, errorStatus, isRateLimit, isRetryable } from './gmail-errors.js';
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
const CONCURRENCY = 8;
const SYNC_BATCH = 100;
// Gmail documents 15,000 quota units per user per minute. Concurrency alone doesn't bound the
// rate (fast responses let 8 workers spend ~800 units/s), so every call takes its cost
// from a per-account bucket that stays under it: 200 + 200/s ≈ 12,200 units/minute.
// A Cloud project can have a lower limit; rate-limit replies then pause the bucket.
const QUOTA_PER_SECOND = 200;
// 15 + 30 + 60×6 s ≈ 7 minutes of waiting before a request gives up.
const RATE_LIMIT_RETRIES = 8;
// Units per call, from https://developers.google.com/gmail/api/reference/quota
const COST = {
  getProfile: 1,
  labelsRead: 1,
  history: 2,
  message: 5,
  list: 5,
  labelsWrite: 5,
  batchModify: 50,
} as const;

type Gmail = gmail_v1.Gmail;

@Injectable()
export class GmailProvider implements MailProvider {
  readonly type = MailProviderType.GMAIL;
  readonly capabilities = { multiLabel: true, folders: false };
  private readonly logger = new Logger(GmailProvider.name);
  // The quota is per user; the refresh token identifies the account.
  private readonly limiters = new Map<string, RateLimiter>();

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

  private limiter(auth: ProviderAuth): RateLimiter {
    let limiter = this.limiters.get(auth.refreshToken);
    if (!limiter) {
      limiter = new RateLimiter(QUOTA_PER_SECOND, QUOTA_PER_SECOND);
      this.limiters.set(auth.refreshToken, limiter);
    }
    return limiter;
  }

  // Waits for quota, retries rate limits / transient errors with exponential backoff and
  // maps auth and not-found errors to provider-agnostic errors. An aborted `signal` stops
  // the waiting at once (a rate-limit pause can last a minute).
  private async call<T>(auth: ProviderAuth, cost: number, fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        await untilAborted(this.limiter(auth).take(cost), signal);
        return await fn();
      } catch (err) {
        if (signal?.aborted) throw signal.reason;
        const status = errorStatus(err);
        if (status === 401 || errorCode(err) === 'invalid_grant') {
          await auth.onAuthFailed?.();
          throw new ProviderAuthError();
        }
        if (status === 404) throw new ProviderNotFoundError();
        if (status === 409) throw new ProviderRequestError(409, 'A tag with this name already exists');
        if (status === 400) throw new ProviderRequestError(400, errorMessage(err) ?? 'Gmail rejected the request');
        if (isRateLimit(err) && attempt < RATE_LIMIT_RETRIES) {
          // Quota is per user per minute, so every request for this account waits, not just
          // this one: 15, 30, then 60 s at a time until the window resets.
          const delay = Math.min(15_000 * 2 ** attempt, 60_000);
          this.logger.warn(`Gmail rate limit (${errorMessage(err)}); pausing ${delay / 1000}s`);
          this.limiter(auth).pause(delay);
          continue;
        }
        if (isRetryable(err) && attempt < 5) {
          await untilAborted(sleep(2 ** attempt * 500 + Math.random() * 250), signal);
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

  private async getSummaries(
    auth: ProviderAuth,
    gmail: Gmail,
    ids: string[],
    signal?: AbortSignal,
  ): Promise<MailMessageSummary[]> {
    const results = await mapLimit(ids, CONCURRENCY, async (id) => {
      try {
        const res = await this.call(
          auth,
          COST.message,
          () => gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: METADATA_HEADERS }),
          signal,
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
    const res = await this.call(auth, COST.list, () =>
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
    const res = await this.call(auth, COST.message, () => gmail.users.messages.get({ userId: 'me', id, format: 'full' }));
    return toFull(res.data);
  }

  private async listAllIds(auth: ProviderAuth, gmail: Gmail, q?: string, signal?: AbortSignal): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.call(
        auth,
        COST.list,
        () => gmail.users.messages.list({ userId: 'me', q, pageToken, maxResults: 500 }),
        signal,
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
      await this.call(auth, COST.batchModify, () =>
        gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: { ids: part, addLabelIds: add, removeLabelIds: remove },
        }),
      );
    }
  }

  async trash(auth: ProviderAuth, ids: string[]): Promise<void> {
    const gmail = this.gmail(auth);
    await mapLimit(ids, CONCURRENCY, (id) => this.call(auth, COST.message, () => gmail.users.messages.trash({ userId: 'me', id })));
  }

  async untrash(auth: ProviderAuth, ids: string[]): Promise<void> {
    const gmail = this.gmail(auth);
    await mapLimit(ids, CONCURRENCY, (id) => this.call(auth, COST.message, () => gmail.users.messages.untrash({ userId: 'me', id })));
  }

  // ---------- Labels ----------

  async listLabels(auth: ProviderAuth, options: { withCounts?: boolean } = {}): Promise<MailLabel[]> {
    const gmail = this.gmail(auth);
    const res = await this.call(auth, COST.labelsRead, () => gmail.users.labels.list({ userId: 'me' }));
    const labels = res.data.labels ?? [];
    if (!options.withCounts) return labels.map(toLabel);

    // labels.list has no counts; fetch them for the user's tags.
    return mapLimit(labels, CONCURRENCY, async (label) => {
      if (label.type === 'system') return toLabel(label);
      const full = await this.call(auth, COST.labelsRead, () => gmail.users.labels.get({ userId: 'me', id: label.id! }));
      return toLabel(full.data);
    });
  }

  async createLabel(
    auth: ProviderAuth,
    input: { name: string; colorBg?: string; colorText?: string },
  ): Promise<MailLabel> {
    const gmail = this.gmail(auth);
    const res = await this.call(auth, COST.labelsWrite, () =>
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
    const res = await this.call(auth, COST.labelsWrite, () =>
      gmail.users.labels.patch({ userId: 'me', id, requestBody: { name: input.name, color: labelColor(input) } }),
    );
    return toLabel(res.data);
  }

  async deleteLabel(auth: ProviderAuth, id: string): Promise<void> {
    const gmail = this.gmail(auth);
    await this.call(auth, COST.labelsWrite, () => gmail.users.labels.delete({ userId: 'me', id }));
  }

  // ---------- Sync ----------

  async fullSync(
    auth: ProviderAuth,
    onBatch: (batch: MailMessageSummary[], progress: SyncProgress) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<{ cursor: string }> {
    const gmail = this.gmail(auth);
    // Take the cursor BEFORE listing, so changes made during the sync are picked up next time.
    const profile = await this.call(auth, COST.getProfile, () => gmail.users.getProfile({ userId: 'me' }), signal);
    const cursor = profile.data.historyId!;

    const ids = await this.listAllIds(auth, gmail, undefined, signal);
    let processed = 0;
    for (const part of chunk(ids, SYNC_BATCH)) {
      const batch = await this.getSummaries(auth, gmail, part, signal);
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
        const res = await this.call(auth, COST.history, () =>
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
