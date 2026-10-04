// The provider-agnostic contract. Gmail is the first implementation; Outlook (Microsoft
// Graph) or IMAP can be added later by implementing this interface and registering it
// in MailProviderRegistry — no changes to controllers, database or frontend.
import type { MailProviderType } from '../generated/prisma/enums.js';

export interface ProviderCapabilities {
  multiLabel: boolean; // Gmail: an email can have many labels
  folders: boolean; // Outlook/IMAP: an email lives in exactly one folder
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface ProviderAuth extends OAuthTokens {
  // Called when the provider refreshes the access token, so it can be persisted.
  onTokensRefreshed?: (tokens: OAuthTokens) => Promise<void>;
  // Called when the provider rejects the credentials (before ProviderAuthError is thrown).
  onAuthFailed?: () => Promise<void>;
}

export interface ProviderProfile {
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface MailAddress {
  email: string;
  name?: string;
}

export interface MailMessageSummary {
  providerMessageId: string;
  threadId: string;
  from: MailAddress;
  subject?: string;
  snippet?: string;
  date: Date;
  sizeBytes: number;
  labelIds: string[];
  isUnread: boolean;
  listUnsubscribe?: string;
}

export interface MailMessageFull extends MailMessageSummary {
  to: MailAddress[];
  cc: MailAddress[];
  html?: string;
  text?: string;
}

export interface MailLabel {
  providerLabelId: string;
  name: string;
  type: 'SYSTEM' | 'USER';
  colorBg?: string;
  colorText?: string;
  messagesTotal?: number;
  messagesUnread?: number;
}

export interface ListMessagesQuery {
  q?: string;
  labelId?: string;
  pageToken?: string;
  limit?: number;
}

export interface MessagePage {
  messages: MailMessageSummary[];
  nextPageToken?: string;
  totalEstimate?: number;
}

// Which emails an action applies to.
export type MessageSelector = { ids: string[] } | { from: string } | { q: string };

export interface SyncProgress {
  total: number;
  processed: number;
}

export interface SyncChanges {
  upserted: MailMessageSummary[];
  deletedIds: string[];
  newCursor: string;
}

export interface MailProvider {
  readonly type: MailProviderType;
  readonly capabilities: ProviderCapabilities;

  // OAuth
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<{ tokens: OAuthTokens; profile: ProviderProfile }>;

  // Messages (live)
  listMessages(auth: ProviderAuth, query: ListMessagesQuery): Promise<MessagePage>;
  getMessage(auth: ProviderAuth, id: string): Promise<MailMessageFull>;
  resolveSelector(auth: ProviderAuth, selector: MessageSelector): Promise<string[]>;
  modifyLabels(auth: ProviderAuth, ids: string[], add: string[], remove: string[]): Promise<void>;
  trash(auth: ProviderAuth, ids: string[]): Promise<void>;
  untrash(auth: ProviderAuth, ids: string[]): Promise<void>;

  // Labels
  listLabels(auth: ProviderAuth): Promise<MailLabel[]>;
  createLabel(auth: ProviderAuth, input: { name: string; colorBg?: string; colorText?: string }): Promise<MailLabel>;
  updateLabel(auth: ProviderAuth, id: string, input: { name?: string; colorBg?: string; colorText?: string }): Promise<MailLabel>;
  deleteLabel(auth: ProviderAuth, id: string): Promise<void>;

  // Sync (metadata into PostgreSQL, triggered by the Sync button)
  fullSync(
    auth: ProviderAuth,
    onBatch: (batch: MailMessageSummary[], progress: SyncProgress) => Promise<void>,
  ): Promise<{ cursor: string }>;
  // Returns null when the cursor is too old and a full sync is required.
  incrementalSync(auth: ProviderAuth, cursor: string): Promise<SyncChanges | null>;
}
