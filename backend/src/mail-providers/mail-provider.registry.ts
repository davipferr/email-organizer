import { Injectable } from '@nestjs/common';
import type { MailProviderType } from '../generated/prisma/enums.js';
import { AppConfig } from '../config/config.module.js';
import type { MailProvider } from './mail-provider.js';
import { GmailProvider } from './gmail/gmail.provider.js';
import { FakeMailProvider } from './fake/fake.provider.js';

// Looks up the implementation for a MailAccount's provider.
@Injectable()
export class MailProviderRegistry {
  private readonly providers: Map<MailProviderType, MailProvider>;

  constructor(config: AppConfig, gmail: GmailProvider, fake: FakeMailProvider) {
    const providers: MailProvider[] = [gmail];
    if (config.get('DEV_LOGIN', { infer: true })) providers.push(fake);
    this.providers = new Map(providers.map((p) => [p.type, p]));
  }

  get(type: MailProviderType): MailProvider {
    const provider = this.providers.get(type);
    if (!provider) throw new Error(`Mail provider not supported: ${type}`);
    return provider;
  }
}
