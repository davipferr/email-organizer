import { Injectable, NotImplementedException } from '@nestjs/common';
import { MailProviderType } from '../../generated/prisma/enums.js';
import { AppConfig } from '../../config/config.module.js';
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

// Only these scopes — never https://mail.google.com/ (permanent delete).
export const GMAIL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
];

@Injectable()
export class GmailProvider implements MailProvider {
  readonly type = MailProviderType.GMAIL;
  readonly capabilities = { multiLabel: true, folders: false };

  constructor(private readonly config: AppConfig) {}

  get redirectUri() {
    return `${this.config.get('APP_URL')}/api/auth/google/callback`;
  }

  getAuthUrl(_state: string): string {
    throw new NotImplementedException();
  }

  exchangeCode(_code: string): Promise<{ tokens: OAuthTokens; profile: ProviderProfile }> {
    throw new NotImplementedException();
  }

  listMessages(_auth: ProviderAuth, _query: ListMessagesQuery): Promise<MessagePage> {
    throw new NotImplementedException();
  }

  getMessage(_auth: ProviderAuth, _id: string): Promise<MailMessageFull> {
    throw new NotImplementedException();
  }

  resolveSelector(_auth: ProviderAuth, _selector: MessageSelector): Promise<string[]> {
    throw new NotImplementedException();
  }

  modifyLabels(_auth: ProviderAuth, _ids: string[], _add: string[], _remove: string[]): Promise<void> {
    throw new NotImplementedException();
  }

  trash(_auth: ProviderAuth, _ids: string[]): Promise<void> {
    throw new NotImplementedException();
  }

  untrash(_auth: ProviderAuth, _ids: string[]): Promise<void> {
    throw new NotImplementedException();
  }

  listLabels(_auth: ProviderAuth): Promise<MailLabel[]> {
    throw new NotImplementedException();
  }

  createLabel(_auth: ProviderAuth, _input: { name: string; colorBg?: string; colorText?: string }): Promise<MailLabel> {
    throw new NotImplementedException();
  }

  updateLabel(
    _auth: ProviderAuth,
    _id: string,
    _input: { name?: string; colorBg?: string; colorText?: string },
  ): Promise<MailLabel> {
    throw new NotImplementedException();
  }

  deleteLabel(_auth: ProviderAuth, _id: string): Promise<void> {
    throw new NotImplementedException();
  }

  fullSync(
    _auth: ProviderAuth,
    _onBatch: (batch: MailMessageSummary[], progress: SyncProgress) => Promise<void>,
  ): Promise<{ cursor: string }> {
    throw new NotImplementedException();
  }

  incrementalSync(_auth: ProviderAuth, _cursor: string): Promise<SyncChanges | null> {
    throw new NotImplementedException();
  }
}
