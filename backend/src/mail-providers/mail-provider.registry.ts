import { Injectable } from '@nestjs/common';
import type { MailProviderType } from '../generated/prisma/enums.js';
import type { MailProvider } from './mail-provider.js';
import { GmailProvider } from './gmail/gmail.provider.js';

// Looks up the implementation for a MailAccount's provider.
@Injectable()
export class MailProviderRegistry {
  private readonly providers: Map<MailProviderType, MailProvider>;

  constructor(gmail: GmailProvider) {
    this.providers = new Map<MailProviderType, MailProvider>([[gmail.type, gmail]]);
  }

  get(type: MailProviderType): MailProvider {
    const provider = this.providers.get(type);
    if (!provider) throw new Error(`Mail provider not supported: ${type}`);
    return provider;
  }
}
